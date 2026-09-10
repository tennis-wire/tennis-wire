package com.tenniswire.user_service;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;

@TestConfiguration(proxyBeanMethods = false)
class TestcontainersConfiguration {

    // Keep in sync with the postgres image in the root docker-compose.yml
    private static final String POSTGRES_IMAGE = "postgres:18-alpine";

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgresContainer() {
        // No stringtype=unspecified, unlike content-service and discussion-service: this schema
        // uses no native enum types and no ltree.
        return new PostgreSQLContainer(POSTGRES_IMAGE);
    }
}
