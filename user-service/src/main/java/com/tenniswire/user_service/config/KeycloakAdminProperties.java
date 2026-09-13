package com.tenniswire.user_service.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("user.keycloak")
public record KeycloakAdminProperties(String baseUrl, String realm, Duration connectTimeout, Duration readTimeout) {}
