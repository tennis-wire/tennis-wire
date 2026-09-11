package com.tenniswire.discussion_service.security;

import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.okJson;
import static com.github.tomakehurst.wiremock.client.WireMock.post;
import static com.github.tomakehurst.wiremock.client.WireMock.postRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.serverError;
import static com.github.tomakehurst.wiremock.client.WireMock.unauthorized;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.options;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.github.tomakehurst.wiremock.WireMockServer;
import com.github.tomakehurst.wiremock.client.ResponseDefinitionBuilder;
import com.tenniswire.discussion_service.config.UserServiceClientConfig;
import com.tenniswire.discussion_service.config.UserServiceProperties;
import com.tenniswire.discussion_service.exception.UserServiceUnavailableException;
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.http.client.ClientHttpRequestFactoryBuilder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.client.RestClient;

class RemoteUserIdResolverIT {

    private static final String RESOLVE = RemoteUserIdResolver.RESOLVE_PATH;
    private static final Duration READ_TIMEOUT = Duration.ofMillis(300);

    private static final WireMockServer USER_SERVICE =
            new WireMockServer(options().dynamicPort());

    private RemoteUserIdResolver resolver;

    @BeforeAll
    static void startUserService() {
        USER_SERVICE.start();
    }

    @AfterAll
    static void stopUserService() {
        USER_SERVICE.stop();
    }

    @BeforeEach
    void freshResolverAndNoStubs() {
        USER_SERVICE.resetAll();
        var properties = new UserServiceProperties(USER_SERVICE.baseUrl(), Duration.ofSeconds(1), READ_TIMEOUT);
        var client = UserServiceClientConfig.restClient(
                RestClient.builder(), ClientHttpRequestFactoryBuilder.jdk(), properties);
        resolver = new RemoteUserIdResolver(client);
    }

    @Test
    void relaysTheReadersOwnTokenAndAsksOncePerSubject() {
        var userId = UUID.randomUUID();
        USER_SERVICE.stubFor(post(urlPathEqualTo(RESOLVE))
                .withHeader("Authorization", equalTo("Bearer reader-token"))
                .willReturn(resolved(userId)));

        assertThat(resolver.resolve(token("reader-token"))).isEqualTo(userId);
        // A refreshed token for the same subject is answered from the cache; the stub would not match it.
        assertThat(resolver.resolve(token("refreshed-token"))).isEqualTo(userId);

        USER_SERVICE.verify(1, postRequestedFor(urlPathEqualTo(RESOLVE)));
    }

    @Test
    void aServerErrorIsAnOutageAndIsNotRemembered() {
        USER_SERVICE.stubFor(post(urlPathEqualTo(RESOLVE)).willReturn(serverError()));

        assertThatThrownBy(() -> resolver.resolve(token("reader-token")))
                .isInstanceOf(UserServiceUnavailableException.class);

        var userId = UUID.randomUUID();
        USER_SERVICE.stubFor(post(urlPathEqualTo(RESOLVE)).willReturn(resolved(userId)));

        assertThat(resolver.resolve(token("reader-token"))).isEqualTo(userId);
        USER_SERVICE.verify(2, postRequestedFor(urlPathEqualTo(RESOLVE)));
    }

    @Test
    void anAnswerSlowerThanTheReadTimeoutIsAnOutage() {
        var tooLate = (int) READ_TIMEOUT.multipliedBy(3).toMillis();
        USER_SERVICE.stubFor(post(urlPathEqualTo(RESOLVE))
                .willReturn(resolved(UUID.randomUUID()).withFixedDelay(tooLate)));

        assertThatThrownBy(() -> resolver.resolve(token("reader-token")))
                .isInstanceOf(UserServiceUnavailableException.class);
    }

    @Test
    void aRefusedTokenEndsAsA503Too() {
        USER_SERVICE.stubFor(post(urlPathEqualTo(RESOLVE)).willReturn(unauthorized()));

        assertThatThrownBy(() -> resolver.resolve(token("reader-token")))
                .isInstanceOf(UserServiceUnavailableException.class);
    }

    @Test
    void anAnswerWithoutAUserIdIsAnOutage() {
        USER_SERVICE.stubFor(post(urlPathEqualTo(RESOLVE)).willReturn(okJson("{}")));

        assertThatThrownBy(() -> resolver.resolve(token("reader-token")))
                .isInstanceOf(UserServiceUnavailableException.class);
    }

    private static ResponseDefinitionBuilder resolved(UUID userId) {
        return okJson("{\"userId\":\"" + userId + "\"}");
    }

    private static Jwt token(String value) {
        return Jwt.withTokenValue(value)
                .header("alg", "none")
                .subject("reader-sub")
                .build();
    }
}
