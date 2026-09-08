package com.tenniswire.discussion_service.exception;

import java.time.Instant;

/** The write gate of the spec §8: an active {@code user_restriction} on the comment capability. */
public class CommentingRestrictedException extends RuntimeException {

    private final Instant restrictedUntil;

    public CommentingRestrictedException(Instant restrictedUntil) {
        super(
                restrictedUntil == null
                        ? "Commenting is restricted"
                        : "Commenting is restricted until " + restrictedUntil);
        this.restrictedUntil = restrictedUntil;
    }

    /** {@code null} when the restriction is indefinite. */
    public Instant restrictedUntil() {
        return restrictedUntil;
    }
}
