package com.tenniswire.user_service.config;

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

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private static final String[] SPRINGDOC_PATHS = {"/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html"};

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http.authorizeHttpRequests(requests -> requests
                        // The error dispatch (/error) must pass, or every 404 from a permitted path
                        // comes back as 401/403 instead.
                        .dispatcherTypeMatchers(DispatcherType.ERROR)
                        .permitAll()
                        .requestMatchers(SPRINGDOC_PATHS)
                        .permitAll()
                        // Before the /internal/** rule below: the more specific path wins only if
                        // it is declared first.
                        .requestMatchers("/internal/identities/resolve")
                        .hasRole(Roles.USER)
                        .requestMatchers("/internal/**")
                        .hasRole(Roles.SERVICE)
                        .requestMatchers("/api/users/me/**")
                        .hasRole(Roles.USER)
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
