package com.tenniswire.api_gateway.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Configuration
@EnableConfigurationProperties(RateLimitProperties.class)
public class RateLimitConfig {

    static final String FORWARDED_FOR = "X-Forwarded-For";

    // A reader is counted by who he is, anyone else by where the ingress says he came from.
    // Neither means the call never passed the ingress - it came over the cluster network from
    // another service - and it goes through uncounted, which is why every route sets
    // deny-empty-key: false
    @Bean
    KeyResolver readerOrAddressKeyResolver() {
        return exchange -> exchange.getPrincipal()
                .filter(JwtAuthenticationToken.class::isInstance)
                .cast(JwtAuthenticationToken.class)
                .map(token -> token.getToken().getSubject())
                .switchIfEmpty(Mono.defer(() -> forwardedFor(exchange)));
    }

    private static Mono<String> forwardedFor(ServerWebExchange exchange) {
        var header = exchange.getRequest().getHeaders().getFirst(FORWARDED_FOR);
        if (header == null) {
            return Mono.empty();
        }
        // "client, proxy1, proxy2": the first entry is the address the ingress saw. It is also the
        // one thing here a caller writes himself, so this bucket slows a flood rather than stopping
        // one. The per-address limit that has to hold belongs at the ingress, which knows the peer.
        var first = header.split(",", 2)[0].trim();
        return first.isEmpty() ? Mono.empty() : Mono.just(first);
    }

    // Primary because the gateway injects one RateLimiter by type, as the default for routes that
    // name none. Every route here names one, so this only decides what an unnamed route would get.
    @Bean
    @Primary
    RedisRateLimiter writeRateLimiter(RateLimitProperties properties) {
        return limiter(properties.writes());
    }

    @Bean
    RedisRateLimiter readRateLimiter(RateLimitProperties properties) {
        return limiter(properties.reads());
    }

    @Bean
    RedisRateLimiter reportRateLimiter(RateLimitProperties properties) {
        return limiter(properties.reports());
    }

    private static RedisRateLimiter limiter(RateLimitProperties.Bucket bucket) {
        return new RedisRateLimiter(bucket.replenishRate(), bucket.burstCapacity(), bucket.requestedTokens());
    }
}
