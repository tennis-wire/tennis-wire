package com.tenniswire.user_service.security;

import com.tenniswire.user_service.config.DeletionProperties;
import com.tenniswire.user_service.exception.ReauthenticationRequiredException;
import java.time.Instant;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

// Whether the reader behind a token signed in recently enough for something that cannot be undone.
// Read off auth_time, which Keycloak keeps through every refresh of the session: a token refreshed
// long after the login still says when the login was.
@Component
public class RecentLogin {

    private static final String AUTH_TIME = "auth_time";

    private final DeletionProperties properties;

    public RecentLogin(DeletionProperties properties) {
        this.properties = properties;
    }

    // A token without the claim counts as an old login: nothing in it says otherwise
    public void require(Jwt jwt) {
        var maxAge = properties.loginMaxAge();
        var authTime = jwt.getClaimAsInstant(AUTH_TIME);
        if (authTime == null || authTime.plus(maxAge).isBefore(Instant.now())) {
            throw new ReauthenticationRequiredException(maxAge);
        }
    }
}
