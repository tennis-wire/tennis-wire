package com.tenniswire.user_service.exception;

public class InvalidDisplayNameException extends RuntimeException {

    public InvalidDisplayNameException(String displayName) {
        super("display name does not match the allowed shape: " + displayName);
    }
}
