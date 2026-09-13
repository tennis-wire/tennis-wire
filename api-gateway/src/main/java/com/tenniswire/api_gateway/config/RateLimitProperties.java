package com.tenniswire.api_gateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("gateway.rate-limit")
public record RateLimitProperties(Bucket writes, Bucket reads, Bucket reports) {

    public record Bucket(int replenishRate, int burstCapacity, int requestedTokens) {}
}
