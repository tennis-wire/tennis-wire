package com.tenniswire.user_service.security;

import com.tenniswire.user_service.service.IdentityService;
import java.util.UUID;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

@Component
public class CurrentUser {

    private static final String PROVIDER = "keycloak";

    private final IdentityService identities;

    public CurrentUser(IdentityService identities) {
        this.identities = identities;
    }

    public UUID id(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalStateException("No token on a path that requires one; check SecurityConfig");
        }
        return identities.resolve(PROVIDER, jwt.getSubject());
    }
}
