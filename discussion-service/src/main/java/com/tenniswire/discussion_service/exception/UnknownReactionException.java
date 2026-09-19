package com.tenniswire.discussion_service.exception;

public class UnknownReactionException extends RuntimeException {

    private static final int ECHOED = 40;

    public UnknownReactionException(String value) {
        super("Unknown reaction: " + value.substring(0, Math.min(value.length(), ECHOED)));
    }
}
