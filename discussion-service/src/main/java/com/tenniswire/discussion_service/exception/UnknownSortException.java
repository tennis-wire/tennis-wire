package com.tenniswire.discussion_service.exception;

// IllegalArgumentException so the handler's 400 covers it, and so a bad sort inside a cursor is
// caught where every other malformed part of that cursor is.
public class UnknownSortException extends IllegalArgumentException {

    private static final int ECHOED = 40;

    public UnknownSortException(String value) {
        super("Unknown sort: " + value.substring(0, Math.min(value.length(), ECHOED)));
    }
}
