package com.tenniswire.discussion_service.security;

import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

/**
 * Controller-side glue over {@link UserIdResolver}. Read endpoints are anonymous-capable, so the
 * principal may be absent there; on write endpoints the security chain guarantees a token.
 */
@Component
public class CurrentUser {

    private final UserIdResolver resolver;

    public CurrentUser(UserIdResolver resolver) {
        this.resolver = resolver;
    }

    public UUID id(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalStateException("No token on a path that requires one; check SecurityConfig");
        }
        return resolver.resolve(jwt);
    }

    public @Nullable UUID idOrNull(@Nullable Jwt jwt) {
        return jwt == null ? null : resolver.resolve(jwt);
    }
}
