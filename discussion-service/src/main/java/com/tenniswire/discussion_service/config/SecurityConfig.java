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

/**
 * Resource server configuration, the same shape as content-service: the gateway's rules for these
 * paths (auth.md §6), enforced again here so that reaching the service port directly buys nothing.
 *
 * <p>Reads are anonymous, but a token on a read is still validated: that is how the viewer's own
 * blocks get applied. Writes need {@code user}; moderation needs {@code moderator}, with the bot
 * allowed to hide comments but not to issue restrictions.
 */
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
