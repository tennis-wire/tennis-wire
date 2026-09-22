package com.tenniswire.discussion_service.exception;

import java.util.UUID;

public class PollClosedException extends RuntimeException {

    public PollClosedException(UUID pollId) {
        super("Poll is closed: " + pollId);
    }
}
