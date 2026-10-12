package com.tenniswire.aggregator_service;

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
        // As in application.yaml: the health snapshot goes in as text, cast to jsonb by the server
        return new PostgreSQLContainer(POSTGRES_IMAGE).withUrlParam("stringtype", "unspecified");
    }
}
