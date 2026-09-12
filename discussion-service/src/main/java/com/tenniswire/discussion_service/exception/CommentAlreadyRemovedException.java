package com.tenniswire.discussion_service.exception;

import java.util.UUID;

public class CommentAlreadyRemovedException extends RuntimeException {

    public CommentAlreadyRemovedException(UUID commentId) {
        super("Comment already removed by moderation: " + commentId);
    }
}
