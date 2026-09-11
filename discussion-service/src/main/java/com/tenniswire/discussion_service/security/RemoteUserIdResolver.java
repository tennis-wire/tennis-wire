package com.tenniswire.discussion_service.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.tenniswire.discussion_service.exception.UserServiceUnavailableException;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jspecify.annotations.Nullable;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Slf4j
public class RemoteUserIdResolver implements UserIdResolver {

    static final String RESOLVE_PATH = "/internal/identities/resolve";

    private static final long MAX_CACHED_SUBJECTS = 100_000;

    private final RestClient userService;
    private final Cache<String, UUID> userIds =
            Caffeine.newBuilder().maximumSize(MAX_CACHED_SUBJECTS).build();

    public RemoteUserIdResolver(RestClient userService) {
        this.userService = userService;
    }

    @Override
    public UUID resolve(Jwt jwt) {
        var subject = jwt.getSubject();
        if (subject == null) {
            throw new IllegalStateException("Validated token carries no sub");
        }
        // Not Cache.get(key, loader): the loader would hold a lock for the whole HTTP call. Two
        // concurrent misses for one subject both ask, which is harmless: resolve is idempotent.
        var cached = userIds.getIfPresent(subject);
        if (cached != null) {
            return cached;
        }
        var userId = ask(jwt);
        userIds.put(subject, userId);
        return userId;
    }

    private UUID ask(Jwt jwt) {
        ResolvedIdentity answer;
        try {
            answer = userService
                    .post()
                    .uri(RESOLVE_PATH)
                    .headers(headers -> headers.setBearerAuth(jwt.getTokenValue()))
                    .retrieve()
                    .body(ResolvedIdentity.class);
        } catch (HttpClientErrorException e) {
            // Not an outage. Resolve takes no parameters, and user-service has refused a token this
            // service accepted a moment ago: the two disagree on issuer or audience, or base-url
            // points at something else. Waiting will not fix it.
            log.error("user-service refused resolve with {}", e.getStatusCode());
            throw new UserServiceUnavailableException("resolve refused with " + e.getStatusCode(), e);
        } catch (RestClientException e) {
            log.warn("user-service resolve failed: {}", e.getMostSpecificCause().toString());
            throw new UserServiceUnavailableException("resolve failed", e);
        }
        var userId = answer == null ? null : answer.userId();
        if (userId == null) {
            log.error("user-service answered resolve without a userId");
            throw new UserServiceUnavailableException("resolve answered without a userId");
        }
        return userId;
    }

    record ResolvedIdentity(@Nullable UUID userId) {}
}
