package com.tenniswire.aggregator_service.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(ExpiryProperties.class)
public class ExpiryConfig {}
