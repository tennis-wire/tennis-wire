package com.tenniswire.discussion_service.config;

import com.tenniswire.discussion_service.service.SubjectTypes;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(SubjectTypeProperties.class)
public class SubjectTypeConfig {

    @Bean
    SubjectTypes subjectTypes(SubjectTypeProperties properties) {
        return new SubjectTypes(properties.subjectTypes());
    }
}
