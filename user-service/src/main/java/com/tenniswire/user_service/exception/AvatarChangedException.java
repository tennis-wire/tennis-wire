package com.tenniswire.user_service.exception;

public class AvatarChangedException extends RuntimeException {

    public AvatarChangedException() {
        super("the avatar has changed since it was looked at");
    }
}
