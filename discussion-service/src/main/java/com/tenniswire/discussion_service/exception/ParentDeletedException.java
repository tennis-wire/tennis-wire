package com.tenniswire.discussion_service.exception;

import java.util.UUID;

public class ParentDeletedException extends RuntimeException {

    public ParentDeletedException(UUID commentId) {
        super("Comment being replied to is no longer standing: " + commentId);
    }
}
