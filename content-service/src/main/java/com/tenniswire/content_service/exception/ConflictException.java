package com.tenniswire.content_service.exception;

import lombok.Getter;

@Getter
public class ConflictException extends RuntimeException {

    // What the client branches on; the message is for people
    private final String error;

    public ConflictException(String message) {
        this("CONFLICT", message);
    }

    public ConflictException(String error, String message) {
        super(message);
        this.error = error;
    }
}
