package com.tenniswire.user_service.exception;

public class DiscussionServiceUnavailableException extends RuntimeException {

    public DiscussionServiceUnavailableException(String message) {
        super(message);
    }

    public DiscussionServiceUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
