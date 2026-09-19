package com.tenniswire.api_gateway.config;

import java.util.Arrays;
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

    @Bean
    KeyResolver readerOrAddressKeyResolver(RateLimitProperties properties) {
        return exchange -> exchange.getPrincipal()
                .filter(JwtAuthenticationToken.class::isInstance)
                .cast(JwtAuthenticationToken.class)
                .map(token -> token.getToken().getSubject())
                .switchIfEmpty(Mono.defer(() -> address(exchange, properties.trustedProxies())));
    }

    private static Mono<String> address(ServerWebExchange exchange, int trustedProxies) {
        var chain = exchange.getRequest().getHeaders().get(FORWARDED_FOR);
        if (chain != null) {
            var entries = chain.stream()
                    .flatMap(header -> Arrays.stream(header.split(",")))
                    .map(String::trim)
                    .filter(entry -> !entry.isEmpty())
                    .toList();
            var written = entries.size() - trustedProxies;
            if (written >= 0 && written < entries.size()) {
                return Mono.just(entries.get(written));
            }
        }
        var peer = exchange.getRequest().getRemoteAddress();
        return peer == null ? Mono.empty() : Mono.just(peer.getHostString());
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

    @Bean
    RedisRateLimiter reactionRateLimiter(RateLimitProperties properties) {
        return limiter(properties.reactions());
    }

    private static RedisRateLimiter limiter(RateLimitProperties.Bucket bucket) {
        return new RedisRateLimiter(bucket.replenishRate(), bucket.burstCapacity(), bucket.requestedTokens());
    }
}
