package com.tenniswire.discussion_service.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(ReactionProperties.class)
public class ReactionConfig {}
