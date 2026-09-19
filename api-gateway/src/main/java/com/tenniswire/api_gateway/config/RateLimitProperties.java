package com.tenniswire.api_gateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("gateway.rate-limit")
public record RateLimitProperties(int trustedProxies, Bucket writes, Bucket reads, Bucket reports, Bucket reactions) {

    public record Bucket(int replenishRate, int burstCapacity, int requestedTokens) {}
}
