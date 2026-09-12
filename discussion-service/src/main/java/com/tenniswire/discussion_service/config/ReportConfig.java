package com.tenniswire.discussion_service.config;

import com.tenniswire.discussion_service.service.ReporterHash;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(ReportProperties.class)
public class ReportConfig {

    @Bean
    ReporterHash reporterHash(ReportProperties properties) {
        return new ReporterHash(properties.hashKey());
    }
}
