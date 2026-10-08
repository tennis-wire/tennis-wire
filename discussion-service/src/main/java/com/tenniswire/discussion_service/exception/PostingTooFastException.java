package com.tenniswire.discussion_service.exception;

import java.time.Duration;

/** A send that came before the author's pace allows: too soon after the last, or past the hour's ceiling. */
public class PostingTooFastException extends RuntimeException {

    private final Duration retryAfter;

    public PostingTooFastException(Duration retryAfter) {
        super("Too soon after the last comment; retry after " + retryAfter.toSeconds() + " s");
        this.retryAfter = retryAfter;
    }

    /** Whole seconds, rounded up and never zero: a client told 0 would send again at once. */
    public long retryAfterSeconds() {
        return Math.max(1, retryAfter.plusNanos(999_999_999).toSeconds());
    }
}
