package com.tenniswire.discussion_service.exception;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse.of("NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<ErrorResponse> handleForbidden(ForbiddenException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ErrorResponse.of("FORBIDDEN", ex.getMessage()));
    }

    @ExceptionHandler(CommentingRestrictedException.class)
    public ResponseEntity<ErrorResponse> handleRestricted(CommentingRestrictedException ex) {
        // details.restrictedUntil is null for an indefinite restriction; the key is always present
        // so the client can tell "indefinite" from "not a restriction error".
        var details = new HashMap<String, Object>();
        details.put("restrictedUntil", ex.restrictedUntil());
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ErrorResponse("COMMENTING_RESTRICTED", ex.getMessage(), null, details, Instant.now()));
    }

    @ExceptionHandler(CommentAlreadyRemovedException.class)
    public ResponseEntity<ErrorResponse> handleAlreadyRemoved(CommentAlreadyRemovedException ex) {
        // 409 rather than 404: the comment is still there as a placeholder, it is its removal that
        // the request conflicts with. The client turns this code into its own wording.
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ErrorResponse.of("COMMENT_ALREADY_REMOVED", ex.getMessage()));
    }

    @ExceptionHandler(ResolutionNotApplicableException.class)
    public ResponseEntity<ErrorResponse> handleResolution(ResolutionNotApplicableException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ErrorResponse.of("RESOLUTION_NOT_APPLICABLE", ex.getMessage()));
    }

    @ExceptionHandler(UserServiceUnavailableException.class)
    public ResponseEntity<ErrorResponse> handleUserServiceUnavailable(UserServiceUnavailableException ex) {
        // Not ex.getMessage(): which dependency failed, and how, belongs in the log at the throw site.
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(ErrorResponse.of("SERVICE_UNAVAILABLE", "Temporarily unavailable"));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        var violations = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> new ErrorResponse.FieldViolation(fe.getField(), fe.getDefaultMessage()))
                .toList();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ErrorResponse("BAD_REQUEST", "Validation failed", violations, null, Instant.now()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorResponse.of("BAD_REQUEST", ex.getMessage()));
    }

    public record ErrorResponse(
            String error,
            String message,
            List<FieldViolation> violations,
            Map<String, Object> details,
            Instant timestamp) {

        static ErrorResponse of(String error, String message) {
            return new ErrorResponse(error, message, null, null, Instant.now());
        }

        public record FieldViolation(String field, String message) {}
    }
}
