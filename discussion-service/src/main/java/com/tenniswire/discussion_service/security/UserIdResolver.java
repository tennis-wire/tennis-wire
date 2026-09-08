package com.tenniswire.discussion_service.security;

import java.util.UUID;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * Maps a validated token to the platform {@code user_id} (auth.md §5). The token is the only
 * source: a caller can never choose its own {@code author_id} through the request body.
 */
public interface UserIdResolver {

    UUID resolve(Jwt jwt);
}
