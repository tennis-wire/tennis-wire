package com.tenniswire.api_gateway.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.web.server.SecurityWebFilterChain;

@Configuration
@EnableWebFluxSecurity
public class SecurityConfig {

    @Bean
    public SecurityWebFilterChain securityWebFilterChain(ServerHttpSecurity http) {
        return http.authorizeExchange(exchanges -> exchanges
                // Actuator health — open
                .pathMatchers("/actuator/health", "/actuator/info")
                .permitAll()
                // TODO: editorial routes — require authentication
                // .pathMatchers("/api/editorial/**", "/api/ai/**", "/api/translate/**", "/api/transcribe/**")
                // .authenticated()
                // For now — permit all
                .anyExchange()
                .permitAll())
            .cors(Customizer.withDefaults()) // delegate to Gateway globalcors config
            .csrf(ServerHttpSecurity.CsrfSpec::disable)
            .build();
    }
}
