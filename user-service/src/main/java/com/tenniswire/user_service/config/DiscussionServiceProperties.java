package com.tenniswire.user_service.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Reached over cluster DNS on its own port: /internal/** is not routed through the gateway. */
@ConfigurationProperties("user.discussion-service")
public record DiscussionServiceProperties(String baseUrl, Duration connectTimeout, Duration readTimeout) {}
