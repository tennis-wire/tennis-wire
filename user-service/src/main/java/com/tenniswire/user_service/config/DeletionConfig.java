package com.tenniswire.user_service.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(DeletionProperties.class)
public class DeletionConfig {}
