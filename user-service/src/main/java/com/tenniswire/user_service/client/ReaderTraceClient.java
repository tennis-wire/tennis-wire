package com.tenniswire.user_service.client;

import com.tenniswire.user_service.exception.DiscussionServiceUnavailableException;
import java.util.UUID;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Asks discussion-service to take away everything it holds about a reader. Safe to call again after
 * an answer goes missing: the far side is idempotent, and a repeat gives the same answer - which is
 * the point, because that answer decides when the account itself may go.
 */
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
        } catch (RestClientException e) {
            throw new DiscussionServiceUnavailableException("could not erase the trace of " + userId, e);
        }
        if (erased == null) {
            // Better to ask again than to read an empty answer as "no ban" and free the address.
            throw new DiscussionServiceUnavailableException("the erase of " + userId + " came back with no answer");
        }
        return erased;
    }
}
