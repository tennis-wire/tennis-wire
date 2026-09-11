package com.tenniswire.discussion_service.client;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Ticker;
import com.tenniswire.discussion_service.exception.UserServiceUnavailableException;
import java.time.Duration;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.security.oauth2.core.OAuth2AuthorizationException;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Public profiles of comment authors, asked of user-service as this service and kept for a short
 * while. Unlike the user_id link, a profile changes: a rename has to reach old comments within
 * minutes, hence the expiry.
 */
@Slf4j
public class AuthorProfileClient {

    static final String LOOKUP_PATH = "/internal/users";

    // user-service's cap per lookup (ProfileService.MAX_LOOKUP_IDS there). A full batch fits its
    // request header limit only because user-service raised that limit to 16 KB.
    static final int BATCH_SIZE = 200;

    static final Duration TTL = Duration.ofMinutes(2);

    private static final long MAX_CACHED_PROFILES = 10_000;

    private static final ParameterizedTypeReference<List<AuthorProfile>> PROFILE_LIST =
            new ParameterizedTypeReference<>() {};

    private final RestClient userService;
    private final Cache<UUID, AuthorProfile> cache;

    public AuthorProfileClient(RestClient userService) {
        this(userService, Ticker.systemTicker());
    }

    AuthorProfileClient(RestClient userService, Ticker ticker) {
        this.userService = userService;
        this.cache = Caffeine.newBuilder()
                .ticker(ticker)
                .expireAfterWrite(TTL)
                .maximumSize(MAX_CACHED_PROFILES)
                .build();
    }

    // Profiles for the given ids, cached ones included. An id user-service does not know is simply
    // absent from the result and is asked again next time. Otherwise all or nothing: if any batch
    // fails, the call fails and nothing it fetched is cached.
    public Map<UUID, AuthorProfile> profiles(Collection<UUID> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        // Cache.getAll runs the loader without holding a lock, once, for all the ids it lacks.
        return cache.getAll(Set.copyOf(ids), this::fetch);
    }

    private Map<UUID, AuthorProfile> fetch(Set<? extends UUID> missing) {
        var ids = List.<UUID>copyOf(missing);
        var found = new HashMap<UUID, AuthorProfile>(ids.size());
        for (var from = 0; from < ids.size(); from += BATCH_SIZE) {
            for (var profile : lookup(ids.subList(from, Math.min(from + BATCH_SIZE, ids.size())))) {
                found.put(profile.id(), profile);
            }
        }
        return found;
    }

    private List<AuthorProfile> lookup(List<UUID> batch) {
        var joined = batch.stream().map(UUID::toString).collect(Collectors.joining(","));
        List<AuthorProfile> answer;
        try {
            answer = userService
                    .get()
                    .uri(uri -> uri.path(LOOKUP_PATH).queryParam("ids", joined).build())
                    .retrieve()
                    .body(PROFILE_LIST);
        } catch (HttpClientErrorException e) {
            // Not an outage. A 400 is a batch built wrong here; a 401 or 403 is the service token
            // or the service role. Retrying fixes neither.
            log.error("user-service refused a profile lookup with {}", e.getStatusCode());
            throw new UserServiceUnavailableException("lookup refused with " + e.getStatusCode(), e);
        } catch (RestClientException e) {
            log.warn(
                    "user-service profile lookup failed: {}",
                    e.getMostSpecificCause().toString());
            throw new UserServiceUnavailableException("lookup failed", e);
        } catch (OAuth2AuthorizationException e) {
            // Thrown while getting the service token, before user-service is called at all. An
            // unreachable or failing Keycloak is an outage; a refusal means this client is misconfigured.
            var cause = e.getCause();
            if (cause instanceof ResourceAccessException || cause instanceof HttpServerErrorException) {
                log.warn(
                        "service token request failed: {}",
                        NestedExceptionUtils.getMostSpecificCause(e).toString());
            } else {
                log.error("service token request refused: {}", e.getError());
            }
            throw new UserServiceUnavailableException("service token unavailable", e);
        }
        if (answer == null) {
            log.error("user-service answered a profile lookup without a body");
            throw new UserServiceUnavailableException("lookup answered without a body");
        }
        return answer;
    }
}
