package com.tenniswire.user_service.client;

import com.tenniswire.user_service.exception.DiscussionServiceUnavailableException;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.security.oauth2.core.OAuth2AuthorizationException;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Asks discussion-service to take away everything it holds about a reader. Safe to call again after
 * an answer goes missing: the far side is idempotent, and a repeat gives the same answer - which is
 * the point, because that answer decides when the account itself may go.
 */
@Slf4j
public class ReaderTraceClient {

    private final RestClient http;

    public ReaderTraceClient(RestClient http) {
        this.http = http;
    }

    public ErasedReader erase(UUID userId) {
        ErasedReader erased;
        try {
            erased = http.delete()
                    .uri("/internal/users/{userId}", userId)
                    .retrieve()
                    .body(ErasedReader.class);
        } catch (HttpClientErrorException e) {
            // Not an outage: a 401 or 403 is the service token or the service role, and asking
            // again will be refused the same way.
            log.error("discussion-service refused an erase with {}", e.getStatusCode());
            throw new DiscussionServiceUnavailableException("erase refused with " + e.getStatusCode(), e);
        } catch (RestClientException e) {
            log.warn("erasing the trace of {} failed: {}", userId, e.getMostSpecificCause());
            throw new DiscussionServiceUnavailableException("could not erase the trace of " + userId, e);
        } catch (OAuth2AuthorizationException e) {
            // Thrown while getting the service token, before discussion-service is called at all.
            var cause = e.getCause();
            if (cause instanceof ResourceAccessException || cause instanceof HttpServerErrorException) {
                log.warn("service token request failed: {}", NestedExceptionUtils.getMostSpecificCause(e));
            } else {
                log.error("service token request refused: {}", e.getError());
            }
            throw new DiscussionServiceUnavailableException("service token unavailable", e);
        }
        if (erased == null) {
            // Better to ask again than to read an empty answer as "no ban" and free the address.
            log.error("discussion-service answered the erase of {} without a body", userId);
            throw new DiscussionServiceUnavailableException("the erase of " + userId + " came back with no answer");
        }
        return erased;
    }
}
