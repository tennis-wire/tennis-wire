package com.tenniswire.discussion_service.exception;

public class UnknownSubjectTypeException extends RuntimeException {

    private static final int ECHOED = 40;

    public UnknownSubjectTypeException(String subjectType) {
        // Cut before echoing: on the listing the value arrives as a query parameter with no size
        // bound of its own, and it goes straight back out in the error body
        super("Unknown subject type: " + subjectType.substring(0, Math.min(subjectType.length(), ECHOED)));
    }
}
