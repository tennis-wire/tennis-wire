package com.tenniswire.user_service.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("user.deletion")
public record DeletionProperties(Duration loginMaxAge) {}
