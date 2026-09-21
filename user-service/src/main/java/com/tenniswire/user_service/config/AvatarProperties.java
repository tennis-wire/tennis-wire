package com.tenniswire.user_service.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("user.avatar")
public record AvatarProperties(long maxPixels, int minSide, float quality, int parallel, Duration queueWait) {}
