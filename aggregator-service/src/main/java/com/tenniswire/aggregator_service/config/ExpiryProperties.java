package com.tenniswire.aggregator_service.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("aggregator.expiry")
public record ExpiryProperties(Duration after, int batchSize) {}
