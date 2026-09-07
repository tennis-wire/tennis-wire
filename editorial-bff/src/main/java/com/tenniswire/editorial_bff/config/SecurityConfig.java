package com.tenniswire.editorial_bff.config;

import com.tenniswire.auth_support.KeycloakJwtAuthenticationConverter;
import com.tenniswire.auth_support.Roles;
import jakarta.servlet.DispatcherType;
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
 * <p>Everything this service does is for authors; there is no public surface. No CORS: browsers
 * never talk to this service, only to the gateway, which owns CORS.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http.authorizeHttpRequests(requests -> requests
                        // The error dispatch (/error) must pass, or every 404 and 500 from a
                        // permitted path comes back as 401/403 instead. Only the container
                        // issues this dispatch, after the real request was already authorized.
                        .dispatcherTypeMatchers(DispatcherType.ERROR)
                        .permitAll()
                        .requestMatchers("/api/ai/**", "/api/translate/**")
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
