package com.tenniswire.aggregator_service.config;

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
                        // The error dispatch must pass, or a 404 from a permitted path comes back as 401
                        .dispatcherTypeMatchers(DispatcherType.ERROR)
                        .permitAll()
                        .requestMatchers(SPRINGDOC_PATHS)
                        .permitAll()
                        // The collector alone: parser, not service, which opens the /internal/** of
                        // user-service and discussion-service too (auth.md 2, 6)
                        .requestMatchers("/internal/**")
                        .hasRole(Roles.PARSER)
                        // Fail closed: the newsroom's /api/aggregator/** comes with part 3
                        .anyRequest()
                        .denyAll())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .csrf(CsrfConfigurer::disable)
                .oauth2ResourceServer(oauth2 ->
                        oauth2.jwt(jwt -> jwt.jwtAuthenticationConverter(KeycloakJwtAuthenticationConverter.create())))
                .build();
    }
}
