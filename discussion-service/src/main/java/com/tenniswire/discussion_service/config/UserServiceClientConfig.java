package com.tenniswire.discussion_service.config;

import com.tenniswire.discussion_service.client.AuthorProfileClient;
import com.tenniswire.discussion_service.security.RemoteUserIdResolver;
import com.tenniswire.discussion_service.security.UserIdResolver;
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
@EnableConfigurationProperties(UserServiceProperties.class)
public class UserServiceClientConfig {

    public static final String REGISTRATION_ID = "user-service";

    // One principal for every call: the token belongs to this service, not to the reader the
    // request happens to be for, so there is one cached token rather than one per reader.
    private static final Authentication SERVICE_PRINCIPAL =
            UsernamePasswordAuthenticationToken.unauthenticated("discussion-service", null);

    @Bean
    UserIdResolver userIdResolver(
            RestClient.Builder builder,
            ClientHttpRequestFactoryBuilder<?> requestFactories,
            UserServiceProperties properties) {
        return new RemoteUserIdResolver(restClient(builder, requestFactories, properties));
    }

    @Bean
    AuthorProfileClient authorProfileClient(
            RestClient.Builder builder,
            ClientHttpRequestFactoryBuilder<?> requestFactories,
            UserServiceProperties properties,
            ClientRegistrationRepository registrations,
            OAuth2AuthorizedClientService authorizedClients) {
        return new AuthorProfileClient(
                serviceRestClient(builder, requestFactories, properties, registrations, authorizedClients));
    }

    public static RestClient restClient(
            RestClient.Builder builder,
            ClientHttpRequestFactoryBuilder<?> requestFactories,
            UserServiceProperties properties) {
        return builder.baseUrl(properties.baseUrl())
                .requestFactory(requestFactories.build(settings(properties)))
                .build();
    }

    // Calls made as this service: every request carries a client_credentials token
    public static RestClient serviceRestClient(
            RestClient.Builder builder,
            ClientHttpRequestFactoryBuilder<?> requestFactories,
            UserServiceProperties properties,
            ClientRegistrationRepository registrations,
            OAuth2AuthorizedClientService authorizedClients) {
        var requestFactory = requestFactories.build(settings(properties));

        // Spring Security's token client with the converters and error handler it sets up by
        // default. Only the request factory is ours: without timeouts a hanging Keycloak would hold
        // the reader's request, and every other one that needs a token at that moment.
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
        // authenticated, keeps the token in the HTTP session. This one keeps it in the service.
        var manager = new AuthorizedClientServiceOAuth2AuthorizedClientManager(registrations, authorizedClients);
        manager.setAuthorizedClientProvider(tokenProvider);

        var interceptor = new OAuth2ClientHttpRequestInterceptor(manager);
        interceptor.setClientRegistrationIdResolver(request -> REGISTRATION_ID);
        interceptor.setPrincipalResolver(request -> SERVICE_PRINCIPAL);
        // A 401 from user-service drops the cached token, so the next call fetches a new one.
        interceptor.setAuthorizationFailureHandler(
                OAuth2ClientHttpRequestInterceptor.authorizationFailureHandler(authorizedClients));

        return builder.baseUrl(properties.baseUrl())
                .requestFactory(requestFactory)
                .requestInterceptor(interceptor)
                .build();
    }

    private static HttpClientSettings settings(UserServiceProperties properties) {
        return HttpClientSettings.defaults().withTimeouts(properties.connectTimeout(), properties.readTimeout());
    }
}
