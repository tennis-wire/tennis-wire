package com.tenniswire.discussion_service.exception;

/** The caller is authenticated but may not do this to this resource (e.g. delete someone else's comment). */
public class ForbiddenException extends RuntimeException {

    public ForbiddenException(String message) {
        super(message);
    }
}
