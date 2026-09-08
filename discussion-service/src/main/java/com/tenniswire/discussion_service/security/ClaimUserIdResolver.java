package com.tenniswire.discussion_service.security;

import java.util.UUID;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

/**
 * Interim resolver while auth.md §5 is open. Prefers a {@code user_id} claim (option b there: a
 * protocol mapper on the realm) and falls back to {@code sub}, which Keycloak issues as a UUID.
 *
 * <p>The fallback means author_id currently equals the Keycloak subject. That contradicts §5's
 * "sub never appears in the schema" and is the thing to replace once user-service and
 * identity_link exist — swap this bean, nothing else changes.
 */
@Component
public class ClaimUserIdResolver implements UserIdResolver {

    static final String USER_ID_CLAIM = "user_id";

    @Override
    public UUID resolve(Jwt jwt) {
        var explicit = jwt.getClaimAsString(USER_ID_CLAIM);
        var raw = explicit != null ? explicit : jwt.getSubject();
        if (raw == null) {
            throw new IllegalStateException("Token carries neither " + USER_ID_CLAIM + " nor sub");
        }
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("Token user id is not a UUID: " + raw, e);
        }
    }
}
