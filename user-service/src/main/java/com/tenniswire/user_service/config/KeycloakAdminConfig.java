package com.tenniswire.user_service.config;

import com.tenniswire.user_service.client.KeycloakAdmin;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.http.client.ClientHttpRequestFactoryBuilder;
import org.springframework.boot.http.client.HttpClientSettings;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.converter.FormHttpMessageConverter;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.AuthorizedClientServiceOAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.client.ClientCredentialsOAuth2AuthorizedClientProvider;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.endpoint.RestClientClientCredentialsTokenResponseClient;
import org.springframework.security.oauth2.client.http.OAuth2ErrorResponseErrorHandler;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.client.OAuth2ClientHttpRequestInterceptor;
import org.springframework.security.oauth2.core.http.converter.OAuth2AccessTokenResponseHttpMessageConverter;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties(KeycloakAdminProperties.class)
public class KeycloakAdminConfig {

    public static final String REGISTRATION_ID = "keycloak-admin";

    // One principal for every call: the token belongs to this service, not to whichever reader
    // happens to be deleting his account, so there is one cached token rather than one per reader.
    private static final Authentication SERVICE_PRINCIPAL =
            UsernamePasswordAuthenticationToken.unauthenticated("user-service", null);

    @Bean
    KeycloakAdmin keycloakAdmin(
            RestClient.Builder builder,
            ClientHttpRequestFactoryBuilder<?> requestFactories,
            KeycloakAdminProperties properties,
            ClientRegistrationRepository registrations,
            OAuth2AuthorizedClientService authorizedClients) {

        var requestFactory = requestFactories.build(
                HttpClientSettings.defaults().withTimeouts(properties.connectTimeout(), properties.readTimeout()));

        // Spring Security's token client with the converters and error handler it sets up by
        // default. Only the request factory is ours: without timeouts a hanging Keycloak holds the
        // reader's delete request, and the erase job's thread with it.
        var tokenClient = new RestClientClientCredentialsTokenResponseClient();
        tokenClient.setRestClient(RestClient.builder()
                .configureMessageConverters(converters -> {
                    converters.addCustomConverter(new FormHttpMessageConverter());
                    converters.addCustomConverter(new OAuth2AccessTokenResponseHttpMessageConverter());
                })
                .defaultStatusHandler(new OAuth2ErrorResponseErrorHandler())
                .requestFactory(requestFactory)
                .build());
        var tokenProvider = new ClientCredentialsOAuth2AuthorizedClientProvider();
        tokenProvider.setAccessTokenResponseClient(tokenClient);

        // Not the default manager: it needs a servlet request and, for a principal that is not
        // authenticated, keeps the token in the HTTP session. The job has neither.
        var manager = new AuthorizedClientServiceOAuth2AuthorizedClientManager(registrations, authorizedClients);
        manager.setAuthorizedClientProvider(tokenProvider);

        var interceptor = new OAuth2ClientHttpRequestInterceptor(manager);
        interceptor.setClientRegistrationIdResolver(request -> REGISTRATION_ID);
        interceptor.setPrincipalResolver(request -> SERVICE_PRINCIPAL);
        // A 401 from Keycloak drops the cached token, so the next call fetches a new one.
        interceptor.setAuthorizationFailureHandler(
                OAuth2ClientHttpRequestInterceptor.authorizationFailureHandler(authorizedClients));

        var http = builder.baseUrl(properties.baseUrl())
                .requestFactory(requestFactory)
                .requestInterceptor(interceptor)
                .build();

        return new KeycloakAdmin(http, properties.realm());
    }
}
