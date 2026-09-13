package com.tenniswire.discussion_service.exception;

import org.jspecify.annotations.Nullable;

public class InvalidCursorException extends RuntimeException {

    // The cursor itself is not echoed: it is ours, opaque, and a broken one says nothing the client
    // could act on beyond starting again
    public InvalidCursorException(@Nullable Throwable cause) {
        super("Cursor was not issued by this service", cause);
    }
}
