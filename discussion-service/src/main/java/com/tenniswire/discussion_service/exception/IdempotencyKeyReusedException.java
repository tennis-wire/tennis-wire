package com.tenniswire.discussion_service.exception;

import java.util.UUID;

public class IdempotencyKeyReusedException extends RuntimeException {

    public IdempotencyKeyReusedException(UUID idempotencyKey) {
        super("Idempotency key was sent before with a different comment: " + idempotencyKey);
    }
}
