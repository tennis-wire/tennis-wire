package com.tenniswire.content_service.exception;

import lombok.Getter;

@Getter
public class ForeignMediaException extends RuntimeException {

    private final String field;

    public ForeignMediaException(String field) {
        super("Only a file uploaded here is accepted in " + field);
        this.field = field;
    }
}
