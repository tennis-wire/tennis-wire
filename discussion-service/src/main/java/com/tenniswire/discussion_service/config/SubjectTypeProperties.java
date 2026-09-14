package com.tenniswire.discussion_service.config;

import java.util.Set;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("discussion")
public record SubjectTypeProperties(Set<String> subjectTypes) {}
