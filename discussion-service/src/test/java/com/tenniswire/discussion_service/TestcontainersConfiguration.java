package com.tenniswire.discussion_service;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;

@TestConfiguration(proxyBeanMethods = false)
class TestcontainersConfiguration {

    // Keep in sync with the postgres image in the root docker-compose.yml. Must be 18+:
    // the schema calls the builtin uuidv7().
    private static final String POSTGRES_IMAGE = "postgres:18-alpine";

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgresContainer() {
        // Same parameter as application.yaml: block_mode and ltree need it, and
        // @ServiceConnection builds the JDBC URL from the container, not from the yaml.
        return new PostgreSQLContainer(POSTGRES_IMAGE).withUrlParam("stringtype", "unspecified");
    }
}
