package com.tenniswire.discussion_service.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("discussion.author-totals")
public record AuthorTotalsProperties(int batchSize) {}
