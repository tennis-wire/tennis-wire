package com.tenniswire.discussion_service.exception;

// user-service gave no answer this request can use. Always a 503 to the caller; the log line where
// it is thrown tells an outage from a misconfiguration.
public class UserServiceUnavailableException extends RuntimeException {

    public UserServiceUnavailableException(String message) {
        super(message);
    }

    public UserServiceUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
