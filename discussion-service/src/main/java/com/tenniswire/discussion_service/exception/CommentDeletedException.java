package com.tenniswire.discussion_service.exception;

import java.util.UUID;

public class CommentDeletedException extends RuntimeException {

    public CommentDeletedException(UUID commentId) {
        super("Comment already deleted by its author: " + commentId);
    }
}
