package com.tenniswire.user_service.exception;

public class UnacceptableImageException extends RuntimeException {

    public enum Reason {
        UNSUPPORTED,
        TOO_LARGE,
        TOO_SMALL
    }

    private final Reason reason;

    public UnacceptableImageException(Reason reason, String message) {
        super(message);
        this.reason = reason;
    }

    public UnacceptableImageException(Reason reason, String message, Throwable cause) {
        super(message, cause);
        this.reason = reason;
    }

    public Reason reason() {
        return reason;
    }
}
