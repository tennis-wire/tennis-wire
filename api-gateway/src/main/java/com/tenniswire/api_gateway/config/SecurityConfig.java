package com.tenniswire.api_gateway.config;

import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.ReactiveJwtAuthenticationConverterAdapter;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsConfigurationSource;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;
import reactor.core.publisher.Mono;

/**
 * <p>The gateway is not the only line of defence: the services behind it validate the same token
 * against the same issuer.
 */
@Configuration
@EnableWebFluxSecurity
public class SecurityConfig {

    private static final String ADMIN = "admin";

    private static final String AUTHOR = "author";

    private static final String[] EDITORIAL_PATHS = {
        "/api/editorial/**", "/api/ai/**", "/api/translate/**", "/api/transcribe/**"
    };

    @Bean
    public SecurityWebFilterChain securityWebFilterChain(ServerHttpSecurity http) {
        return http.authorizeExchange(exchanges -> exchanges
                        // health/** covers the liveness and readiness probes
                        .pathMatchers("/actuator/health/**", "/actuator/info")
                        .permitAll()
                        // Exposed only under the local profile, and admin-only even there.
                        .pathMatchers("/actuator/gateway/**")
                        .hasRole(ADMIN)
                        .pathMatchers("/api/public/**")
                        .permitAll()
                        .pathMatchers(EDITORIAL_PATHS)
                        .hasRole(AUTHOR)
                        // Fail closed: a route without a rule is unreachable, not merely
                        // reachable by anyone who happens to be logged in.
                        .anyExchange()
                        .denyAll())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                .httpBasic(ServerHttpSecurity.HttpBasicSpec::disable)
                .formLogin(ServerHttpSecurity.FormLoginSpec::disable)
                .oauth2ResourceServer(
                        oauth2 -> oauth2.jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter())))
                .build();
    }

    private Converter<Jwt, Mono<AbstractAuthenticationToken>> jwtAuthenticationConverter() {
        var converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(new KeycloakRealmRoleConverter());
        return new ReactiveJwtAuthenticationConverterAdapter(converter);
    }

    // CORS config applied at Security filter level — ensures preflight gets headers
    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        var config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(
                "http://localhost:5173", // Editorial UI (Vite dev server)
                "http://localhost:3000" // Public Web (Next.js dev server)
                // TODO: add production domain
                ));
        config.setAllowedMethods(List.of("GET", "POST", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Content-Type", "Authorization"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
