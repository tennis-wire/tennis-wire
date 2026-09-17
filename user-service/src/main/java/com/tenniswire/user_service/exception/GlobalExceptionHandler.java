package com.tenniswire.user_service.exception;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse.of("NOT_FOUND", ex.getMessage()));
    }

    // 401 with the challenge from RFC 9470, so a client that reads it knows to send the reader through a
    // login with max_age. The site's proxy passes no headers back and goes by the code in the body.
    @ExceptionHandler(ReauthenticationRequiredException.class)
    public ResponseEntity<ErrorResponse> handleReauthentication(ReauthenticationRequiredException ex) {
        var challenge = "Bearer error=\"insufficient_user_authentication\", "
                + "error_description=\"A more recent login is required\", "
                + "max_age=\"" + ex.maxAge().toSeconds() + "\"";
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .header(HttpHeaders.WWW_AUTHENTICATE, challenge)
                .body(ErrorResponse.of("REAUTHENTICATION_REQUIRED", ex.getMessage()));
    }

    @ExceptionHandler(DisplayNameTakenException.class)
    public ResponseEntity<ErrorResponse> handleTaken(DisplayNameTakenException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorResponse.of("DISPLAY_NAME_TAKEN", ex.getMessage()));
    }

    // Reached only when something bypasses the request DTO; the annotation catches the rest
    @ExceptionHandler(InvalidDisplayNameException.class)
    public ResponseEntity<ErrorResponse> handleInvalidName(InvalidDisplayNameException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorResponse.of("BAD_REQUEST", ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        var violations = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> new ErrorResponse.FieldViolation(fe.getField(), fe.getDefaultMessage()))
                .toList();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ErrorResponse("BAD_REQUEST", "Validation failed", violations, Instant.now()));
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ErrorResponse> handleParameterValidation(HandlerMethodValidationException ex) {
        var message = ex.getAllErrors().stream()
                .map(MessageSourceResolvable::getDefaultMessage)
                .filter(Objects::nonNull)
                .collect(Collectors.joining("; "));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ErrorResponse.of("BAD_REQUEST", message.isBlank() ? "Validation failed" : message));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorResponse.of("BAD_REQUEST", ex.getMessage()));
    }

    public record ErrorResponse(String error, String message, List<FieldViolation> violations, Instant timestamp) {

        static ErrorResponse of(String error, String message) {
            return new ErrorResponse(error, message, null, Instant.now());
        }

        public record FieldViolation(String field, String message) {}
    }
}
