package com.tenniswire.content_service.exception;

import lombok.Getter;
import java.util.List;

@Getter
public class PublishValidationException extends RuntimeException {

    private final List<Violation> violations;

    public PublishValidationException(List<Violation> violations) {
        super("Article cannot be published");
        this.violations = violations;
    }

    public record Violation(String field, String message) {}
}
