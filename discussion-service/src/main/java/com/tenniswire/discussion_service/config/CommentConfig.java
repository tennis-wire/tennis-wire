package com.tenniswire.discussion_service.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(CommentProperties.class)
public class CommentConfig {}
