package com.tenniswire.content_service.config;

import com.tenniswire.auth_support.KeycloakJwtAuthenticationConverter;
import com.tenniswire.auth_support.Roles;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.CsrfConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Resource server configuration: the same rules the gateway applies to these paths, enforced again
 * here so that reaching the service port directly buys nothing.
 *
 * <p>No CORS: browsers never talk to this service, only to the gateway, which owns CORS.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    // Not routed through the gateway, so reachable only on the service port. permitAll
    // here is harmless in the default profile, where springdoc is off and the paths do
    // not exist; under the local profile it lets the docs open without a token.
    private static final String[] SPRINGDOC_PATHS = {"/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html"};

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http.authorizeHttpRequests(requests -> requests.requestMatchers("/api/public/**")
                        .permitAll()
                        .requestMatchers(SPRINGDOC_PATHS)
                        .permitAll()
                        .requestMatchers("/api/editorial/**")
                        .hasRole(Roles.AUTHOR)
                        // Fail closed, as in the gateway: a path without a rule is unreachable.
                        .anyRequest()
                        .denyAll())
                // Bearer tokens only: no session to protect, so CSRF has nothing to do.
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .csrf(CsrfConfigurer::disable)
                .oauth2ResourceServer(oauth2 ->
                        oauth2.jwt(jwt -> jwt.jwtAuthenticationConverter(KeycloakJwtAuthenticationConverter.create())))
                .build();
    }
}
