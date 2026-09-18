package com.tenniswire.discussion_service.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("discussion.comment")
public record CommentProperties(Duration editWindow) {}
