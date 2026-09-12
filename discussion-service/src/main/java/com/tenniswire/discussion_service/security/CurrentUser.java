package com.tenniswire.discussion_service.security;

import com.tenniswire.auth_support.Roles;
import com.tenniswire.discussion_service.exception.ForbiddenException;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

@Component
public class CurrentUser {

    // Checked on the granted authority, as SecurityConfig does, not on realm_access in the token:
    // the two agree in production, but jwt().authorities(...) in tests sets only the authority.
    private static final String READER = "ROLE_" + Roles.USER;

    private static final String MODERATOR = "ROLE_" + Roles.MODERATOR;

    private final UserIdResolver resolver;

    public CurrentUser(UserIdResolver resolver) {
        this.resolver = resolver;
    }

    public UUID id(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalStateException("No token on a path that requires one; check SecurityConfig");
        }
        if (!isReader()) {
            throw new ForbiddenException("This action needs an account with the user role");
        }
        return resolver.resolve(jwt);
    }

    public @Nullable UUID idOrNull(@Nullable Jwt jwt) {
        return jwt != null && isReader() ? resolver.resolve(jwt) : null;
    }

    // Whether a person is acting rather than the classifier: the bot has no reader profile.
    public boolean isModerator() {
        return hasAuthority(MODERATOR);
    }

    private static boolean isReader() {
        return hasAuthority(READER);
    }

    private static boolean hasAuthority(String authority) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null
                && authentication.getAuthorities().stream()
                        .map(GrantedAuthority::getAuthority)
                        .anyMatch(authority::equals);
    }
}
