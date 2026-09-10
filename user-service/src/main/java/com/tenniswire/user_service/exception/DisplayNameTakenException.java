package com.tenniswire.user_service.exception;

public class DisplayNameTakenException extends RuntimeException {

    public DisplayNameTakenException(String displayName) {
        super("display name already taken: " + displayName);
    }
}
