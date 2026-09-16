package com.tenniswire.discussion_service.exception;

public class BlockListFullException extends RuntimeException {

    private final int limit;

    public BlockListFullException(int limit) {
        super("The block list already holds " + limit + " users");
        this.limit = limit;
    }

    public int limit() {
        return limit;
    }
}
