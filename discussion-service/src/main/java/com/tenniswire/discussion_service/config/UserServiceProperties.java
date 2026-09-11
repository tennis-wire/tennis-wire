package com.tenniswire.discussion_service.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("discussion.user-service")
public record UserServiceProperties(String baseUrl, Duration connectTimeout, Duration readTimeout) {}
