package com.tenniswire.content_service.exception;

public class UnsupportedImageException extends RuntimeException {

    public UnsupportedImageException(String message) {
        super(message);
    }

    public UnsupportedImageException(String message, Throwable cause) {
        super(message, cause);
    }
}
