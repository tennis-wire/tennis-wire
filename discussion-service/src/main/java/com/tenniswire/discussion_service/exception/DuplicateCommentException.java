package com.tenniswire.discussion_service.exception;

/** The author has posted this text already: in this discussion at any time, or anywhere just now. */
public class DuplicateCommentException extends RuntimeException {

    public DuplicateCommentException() {
        super("The same text has already been posted");
    }
}
