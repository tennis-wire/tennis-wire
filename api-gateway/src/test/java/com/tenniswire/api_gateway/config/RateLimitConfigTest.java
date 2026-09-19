package com.tenniswire.api_gateway.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.InetSocketAddress;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

class RateLimitConfigTest {

    private static final int ONE_PROXY = 1;

    private final KeyResolver resolver = new RateLimitConfig()
            .readerOrAddressKeyResolver(new RateLimitProperties(ONE_PROXY, null, null, null, null));

    @Test
    void aReaderIsCountedByHisSubject() {
        var exchange = request()
                .mutate()
                .principal(Mono.just(tokenFor("reader-subject")))
                .build();

        assertThat(resolver.resolve(exchange).block()).isEqualTo("reader-subject");
    }

    @Test
    void anAnonymousCallIsCountedByWhatTheNearestProxyWrote() {
        var exchange = forwardedFor("caller-address");

        assertThat(resolver.resolve(exchange).block()).isEqualTo("caller-address");
    }

    @Test
    void whatTheCallerPutInFrontOfThatIsIgnored() {
        // the ingress appends what it saw, so the entry it wrote is last whatever came before it
        var exchange = forwardedFor("invented, also-invented, caller-address");

        assertThat(resolver.resolve(exchange).block()).isEqualTo("caller-address");
    }

    @Test
    void aSubjectWinsOverAnAddress() {
        var exchange = forwardedFor("caller-address")
                .mutate()
                .principal(Mono.just(tokenFor("reader-subject")))
                .build();

        assertThat(resolver.resolve(exchange).block()).isEqualTo("reader-subject");
    }

    @Test
    void withNoChainAtAllThePeerOfTheConnectionAnswers() {
        var exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/api/discussion/comments")
                .remoteAddress(InetSocketAddress.createUnresolved("peer-host", 40404)));

        assertThat(resolver.resolve(exchange).block()).isEqualTo("peer-host");
    }

    @Test
    void nothingToCountAgainstMeansNoKeyAtAll() {
        assertThat(resolver.resolve(request()).block()).isNull();
    }

    private static ServerWebExchange request() {
        return MockServerWebExchange.from(MockServerHttpRequest.get("/api/discussion/comments"));
    }

    private static ServerWebExchange forwardedFor(String chain) {
        return MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/discussion/comments").header(RateLimitConfig.FORWARDED_FOR, chain));
    }

    private static JwtAuthenticationToken tokenFor(String subject) {
        var jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject(subject)
                .build();
        return new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority("ROLE_user")));
    }
}
