package com.tenniswire.api_gateway.config;

import static org.assertj.core.api.Assertions.assertThat;

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

    private final KeyResolver resolver = new RateLimitConfig().readerOrAddressKeyResolver();

    @Test
    void aReaderIsCountedByHisSubject() {
        var exchange = withForwardedFor(null)
                .mutate()
                .principal(Mono.just(tokenFor("reader-subject")))
                .build();

        assertThat(resolver.resolve(exchange).block()).isEqualTo("reader-subject");
    }

    @Test
    void anAnonymousCallIsCountedByWhatTheIngressForwarded() {
        var exchange = withForwardedFor("caller-address, proxy-address");

        assertThat(resolver.resolve(exchange).block()).isEqualTo("caller-address");
    }

    @Test
    void aSubjectWinsOverAForwardedAddress() {
        var exchange = withForwardedFor("caller-address")
                .mutate()
                .principal(Mono.just(tokenFor("reader-subject")))
                .build();

        assertThat(resolver.resolve(exchange).block()).isEqualTo("reader-subject");
    }

    @Test
    void neitherOneMeansNoKeyAtAll() {
        assertThat(resolver.resolve(withForwardedFor(null)).block()).isNull();
    }

    private static ServerWebExchange withForwardedFor(String value) {
        var request = MockServerHttpRequest.get("/api/discussion/comments");
        if (value != null) {
            request = request.header(RateLimitConfig.FORWARDED_FOR, value);
        }
        return MockServerWebExchange.from(request);
    }

    private static JwtAuthenticationToken tokenFor(String subject) {
        var jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject(subject)
                .build();
        return new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority("ROLE_user")));
    }
}
