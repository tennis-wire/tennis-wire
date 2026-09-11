package com.tenniswire.discussion_service.client;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.containing;
import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.getRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.matching;
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
import com.tenniswire.discussion_service.config.UserServiceClientConfig;
import com.tenniswire.discussion_service.config.UserServiceProperties;
import com.tenniswire.discussion_service.exception.UserServiceUnavailableException;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.http.client.ClientHttpRequestFactoryBuilder;
import org.springframework.security.oauth2.client.InMemoryOAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.web.client.RestClient;

class AuthorProfileClientIT {

    private static final String TOKEN = "/protocol/openid-connect/token";
    private static final String LOOKUP = AuthorProfileClient.LOOKUP_PATH;
    private static final Duration READ_TIMEOUT = Duration.ofMillis(300);
    private static final String TOKEN_RESPONSE =
            "{\"access_token\":\"service-token\",\"token_type\":\"Bearer\",\"expires_in\":300}";

    // 16 KB for request line and headers, as user-service allows since its fix. Jetty's default 8 KB
    // would leave a full batch a few hundred bytes of room, and this test is not about that limit.
    private static final WireMockServer SERVER =
            new WireMockServer(options().dynamicPort().jettyHeaderRequestSize(16 * 1024));

    private final AtomicLong nanos = new AtomicLong();
    private final UUID alice = UUID.randomUUID();
    private final UUID bob = UUID.randomUUID();

    private AuthorProfileClient client;

    @BeforeAll
    static void startServer() {
        SERVER.start();
    }

    @AfterAll
    static void stopServer() {
        SERVER.stop();
    }

    @BeforeEach
    void freshClientAndAWorkingTokenEndpoint() {
        SERVER.resetAll();
        SERVER.stubFor(post(urlPathEqualTo(TOKEN))
                .withHeader("Authorization", matching("Basic .+"))
                .withRequestBody(containing("grant_type=client_credentials"))
                .willReturn(okJson(TOKEN_RESPONSE)));

        var registration = ClientRegistration.withRegistrationId(UserServiceClientConfig.REGISTRATION_ID)
                .clientId("discussion-service")
                .clientSecret("secret")
                .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                .tokenUri(SERVER.baseUrl() + TOKEN)
                .build();
        var registrations = new InMemoryClientRegistrationRepository(registration);
        var properties = new UserServiceProperties(SERVER.baseUrl(), Duration.ofSeconds(1), READ_TIMEOUT);
        var restClient = UserServiceClientConfig.serviceRestClient(
                RestClient.builder(),
                ClientHttpRequestFactoryBuilder.jdk(),
                properties,
                registrations,
                new InMemoryOAuth2AuthorizedClientService(registrations));
        client = new AuthorProfileClient(restClient, nanos::get);
    }

    @Test
    void asksAsTheServiceAndFetchesTheTokenOnlyOnce() {
        stubProfiles(alice, "[" + profile(alice, "alice") + "]");
        stubProfiles(bob, "[" + profile(bob, "bob") + "]");

        assertThat(client.profiles(List.of(alice))).containsOnlyKeys(alice);
        assertThat(client.profiles(List.of(bob)).get(bob).displayName()).isEqualTo("bob");

        SERVER.verify(1, postRequestedFor(urlPathEqualTo(TOKEN)));
        var withServiceToken =
                getRequestedFor(urlPathEqualTo(LOOKUP)).withHeader("Authorization", equalTo("Bearer service-token"));
        SERVER.verify(2, withServiceToken);
    }

    @Test
    void onlyTheIdsMissingFromTheCacheAreAsked() {
        stubProfiles(alice, "[" + profile(alice, "alice") + "]");
        stubProfiles(bob, "[" + profile(bob, "bob") + "]");

        client.profiles(List.of(alice));
        assertThat(client.profiles(List.of(alice, bob))).containsOnlyKeys(alice, bob);

        SERVER.verify(1, getRequestedFor(urlPathEqualTo(LOOKUP)).withQueryParam("ids", equalTo(alice.toString())));
        SERVER.verify(1, getRequestedFor(urlPathEqualTo(LOOKUP)).withQueryParam("ids", equalTo(bob.toString())));
    }

    @Test
    void aCachedProfileIsAskedAgainOnceTheTtlHasPassed() {
        stubProfiles(alice, "[" + profile(alice, "alice") + "]");

        client.profiles(List.of(alice));
        nanos.addAndGet(AuthorProfileClient.TTL.minusSeconds(1).toNanos());
        client.profiles(List.of(alice));
        SERVER.verify(1, getRequestedFor(urlPathEqualTo(LOOKUP)));

        nanos.addAndGet(Duration.ofSeconds(2).toNanos());
        client.profiles(List.of(alice));
        SERVER.verify(2, getRequestedFor(urlPathEqualTo(LOOKUP)));
    }

    @Test
    void anIdUserServiceDoesNotKnowIsLeftOutAndNotRemembered() {
        stubProfiles(alice, "[]");

        assertThat(client.profiles(List.of(alice))).isEmpty();
        assertThat(client.profiles(List.of(alice))).isEmpty();

        SERVER.verify(2, getRequestedFor(urlPathEqualTo(LOOKUP)));
    }

    @Test
    void moreIdsThanABatchAreSplitAcrossRequests() {
        SERVER.stubFor(get(urlPathEqualTo(LOOKUP)).willReturn(okJson("[]")));
        var ids = Stream.generate(UUID::randomUUID)
                .limit(AuthorProfileClient.BATCH_SIZE + 1)
                .toList();

        client.profiles(ids);

        var batchSizes = SERVER.findAll(getRequestedFor(urlPathEqualTo(LOOKUP))).stream()
                .map(request -> request.queryParameter("ids").firstValue().split(",").length)
                .toList();
        assertThat(batchSizes).containsExactlyInAnyOrder(AuthorProfileClient.BATCH_SIZE, 1);
    }

    @Test
    void aServerErrorIsAnOutageAndNothingIsRemembered() {
        SERVER.stubFor(get(urlPathEqualTo(LOOKUP)).willReturn(serverError()));

        assertThatThrownBy(() -> client.profiles(List.of(alice))).isInstanceOf(UserServiceUnavailableException.class);

        stubProfiles(alice, "[" + profile(alice, "alice") + "]");
        assertThat(client.profiles(List.of(alice))).containsOnlyKeys(alice);
        SERVER.verify(2, getRequestedFor(urlPathEqualTo(LOOKUP)));
    }

    @Test
    void aRejectedServiceTokenIsDroppedAndFetchedAnew() {
        SERVER.stubFor(get(urlPathEqualTo(LOOKUP)).willReturn(unauthorized()));

        assertThatThrownBy(() -> client.profiles(List.of(alice))).isInstanceOf(UserServiceUnavailableException.class);

        stubProfiles(alice, "[" + profile(alice, "alice") + "]");
        assertThat(client.profiles(List.of(alice))).containsOnlyKeys(alice);
        SERVER.verify(2, postRequestedFor(urlPathEqualTo(TOKEN)));
    }

    @Test
    void aFailingTokenEndpointIsAnOutageAndUserServiceIsNotCalled() {
        SERVER.stubFor(post(urlPathEqualTo(TOKEN)).willReturn(serverError()));

        assertThatThrownBy(() -> client.profiles(List.of(alice))).isInstanceOf(UserServiceUnavailableException.class);

        SERVER.verify(0, getRequestedFor(urlPathEqualTo(LOOKUP)));
    }

    @Test
    void aHangingTokenEndpointTimesOut() {
        var tooLate = (int) READ_TIMEOUT.multipliedBy(3).toMillis();
        SERVER.stubFor(post(urlPathEqualTo(TOKEN))
                .willReturn(aResponse().withStatus(200).withFixedDelay(tooLate)));

        assertThatThrownBy(() -> client.profiles(List.of(alice))).isInstanceOf(UserServiceUnavailableException.class);
    }

    private static void stubProfiles(UUID id, String body) {
        SERVER.stubFor(get(urlPathEqualTo(LOOKUP))
                .withQueryParam("ids", equalTo(id.toString()))
                .willReturn(okJson(body)));
    }

    private static String profile(UUID id, String displayName) {
        return "{\"id\":\"" + id + "\",\"displayName\":\"" + displayName + "\",\"avatarUrl\":null}";
    }
}
