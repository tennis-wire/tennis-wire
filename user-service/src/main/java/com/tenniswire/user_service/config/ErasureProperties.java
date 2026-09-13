package com.tenniswire.user_service.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("user.erasure")
public record ErasureProperties(Duration graceMargin, Duration recheck, Duration lifespanCache, int batchSize) {}
