package com.tenniswire.discussion_service.exception;

import java.util.UUID;

public class EditWindowClosedException extends RuntimeException {

    public EditWindowClosedException(UUID commentId) {
        super("The window for editing comment " + commentId + " has closed");
    }
}
