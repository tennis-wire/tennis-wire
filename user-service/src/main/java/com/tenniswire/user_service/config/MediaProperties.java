package com.tenniswire.user_service.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("tw.media")
public record MediaProperties(
        String publicBaseUrl,
        String endpoint,
        String region,
        String bucket,
        String accessKey,
        String secretKey,
        boolean pathStyle,
        String cacheControl,
        Duration connectTimeout,
        Duration readTimeout) {}
