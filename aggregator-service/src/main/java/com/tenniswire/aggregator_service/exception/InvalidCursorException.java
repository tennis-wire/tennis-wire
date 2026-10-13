package com.tenniswire.aggregator_service.exception;

import org.jspecify.annotations.Nullable;

public class InvalidCursorException extends RuntimeException {

    // The cursor is not echoed: it is ours and opaque, a broken one only means starting again
    public InvalidCursorException(@Nullable Throwable cause) {
        super("Cursor was not issued by this service", cause);
    }
}
