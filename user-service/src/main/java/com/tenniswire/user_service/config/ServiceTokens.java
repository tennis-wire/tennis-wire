package com.tenniswire.user_service.config;

import org.springframework.http.client.ClientHttpRequestFactory;
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

/**
 * This service's own token, for calls it makes as itself rather than on behalf of whoever is on the
 * line. One registration serves every such call: the token is the same whichever door it opens, and
 * a second registration against the same client would only mean fetching it twice.
 */
final class ServiceTokens {

    static final String REGISTRATION_ID = "service-account";

    // One principal for every call, so there is one cached token rather than one per reader.
    private static final Authentication SERVICE_PRINCIPAL =
            UsernamePasswordAuthenticationToken.unauthenticated("user-service", null);

    private ServiceTokens() {}

    static OAuth2ClientHttpRequestInterceptor interceptor(
            ClientRegistrationRepository registrations,
            OAuth2AuthorizedClientService authorizedClients,
            ClientHttpRequestFactory requestFactory) {

        // Spring Security's token client with the converters and error handler it sets up by
        // default. Only the request factory is ours: without timeouts a hanging Keycloak holds the
        // reader's request, and the erase job's thread with it.
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
        // A 401 drops the cached token, so the next call fetches a new one.
        interceptor.setAuthorizationFailureHandler(
                OAuth2ClientHttpRequestInterceptor.authorizationFailureHandler(authorizedClients));
        return interceptor;
    }
}
