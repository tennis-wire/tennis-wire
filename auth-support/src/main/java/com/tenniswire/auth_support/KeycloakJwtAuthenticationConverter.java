package com.tenniswire.auth_support;

import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;

public final class KeycloakJwtAuthenticationConverter {

    private KeycloakJwtAuthenticationConverter() {}

    public static JwtAuthenticationConverter create() {
        var converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(new KeycloakRealmRoleConverter());
        return converter;
    }
}
