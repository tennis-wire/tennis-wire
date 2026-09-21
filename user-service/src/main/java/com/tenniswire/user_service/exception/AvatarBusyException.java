package com.tenniswire.user_service.exception;

public class AvatarBusyException extends RuntimeException {

    public AvatarBusyException() {
        super("too many avatars are being processed, try again");
    }
}
