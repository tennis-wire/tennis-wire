package com.tenniswire.user_service.exception;

import java.time.Duration;

public class ReauthenticationRequiredException extends RuntimeException {

    private final Duration maxAge;

    public ReauthenticationRequiredException(Duration maxAge) {
        super("a login no older than " + maxAge.toSeconds() + " seconds is required");
        this.maxAge = maxAge;
    }

    public Duration maxAge() {
        return maxAge;
    }
}
