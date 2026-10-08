package com.tenniswire.discussion_service.exception;

public class TooManyLinksException extends RuntimeException {

    private final int limit;

    public TooManyLinksException(int limit) {
        super("A comment carries at most " + limit + " links");
        this.limit = limit;
    }

    public int limit() {
        return limit;
    }
}
