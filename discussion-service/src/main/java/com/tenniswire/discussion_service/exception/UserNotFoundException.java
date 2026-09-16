package com.tenniswire.discussion_service.exception;

import java.util.UUID;

// Someone user-service has no profile for: never registered, or erased since
public class UserNotFoundException extends RuntimeException {

    public UserNotFoundException(UUID userId) {
        super("User not found: " + userId);
    }
}
