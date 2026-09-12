package com.tenniswire.discussion_service.config;

import com.tenniswire.auth_support.KeycloakJwtAuthenticationConverter;
import com.tenniswire.auth_support.Roles;
import jakarta.servlet.DispatcherType;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
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
                        // The error dispatch (/error) must pass, or every 404 and 500 from a
                        // permitted path comes back as 401/403 instead.
                        .dispatcherTypeMatchers(DispatcherType.ERROR)
                        .permitAll()
                        .requestMatchers(SPRINGDOC_PATHS)
                        .permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/discussion/comments/**")
                        .permitAll()
                        .requestMatchers("/api/discussion/moderation/restrictions/**")
                        .hasRole(Roles.MODERATOR)
                        // Filing is the classifier's job and reading the queue is a person's;
                        // neither has any use for the other's half.
                        .requestMatchers(HttpMethod.POST, "/api/discussion/moderation/reports")
                        .hasRole(Roles.MODERATOR_BOT)
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/discussion/moderation/reports",
                                "/api/discussion/moderation/reports/**")
                        .hasRole(Roles.MODERATOR)
                        .requestMatchers(HttpMethod.PATCH, "/api/discussion/moderation/reports/**")
                        .hasRole(Roles.MODERATOR)
                        .requestMatchers("/api/discussion/moderation/**")
                        .hasAnyRole(Roles.MODERATOR, Roles.MODERATOR_BOT)
                        .requestMatchers("/api/discussion/comments/**", "/api/discussion/blocks/**")
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
