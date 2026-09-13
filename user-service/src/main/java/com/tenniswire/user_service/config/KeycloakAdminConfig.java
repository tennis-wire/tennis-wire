package com.tenniswire.user_service.config;

import com.tenniswire.user_service.client.KeycloakAdmin;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.http.client.ClientHttpRequestFactoryBuilder;
import org.springframework.boot.http.client.HttpClientSettings;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties(KeycloakAdminProperties.class)
public class KeycloakAdminConfig {

    @Bean
    KeycloakAdmin keycloakAdmin(
            RestClient.Builder builder,
            ClientHttpRequestFactoryBuilder<?> requestFactories,
            KeycloakAdminProperties properties,
            ClientRegistrationRepository registrations,
            OAuth2AuthorizedClientService authorizedClients) {

        var requestFactory = requestFactories.build(
                HttpClientSettings.defaults().withTimeouts(properties.connectTimeout(), properties.readTimeout()));

        var http = builder.baseUrl(properties.baseUrl())
                .requestFactory(requestFactory)
                .requestInterceptor(ServiceTokens.interceptor(registrations, authorizedClients, requestFactory))
                .build();

        return new KeycloakAdmin(http, properties.realm());
    }
}
