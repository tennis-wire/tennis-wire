package com.tenniswire.content_service.exception;

import java.time.Instant;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse("NOT_FOUND", ex.getMessage(), null, Instant.now()));
    }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ErrorResponse> handleConflict(ConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ErrorResponse(ex.error(), ex.getMessage(), null, Instant.now()));
    }

    // Another save got in between reading the version and writing the row
    @ExceptionHandler(OptimisticLockingFailureException.class)
    public ResponseEntity<ErrorResponse> handleOptimisticLock(OptimisticLockingFailureException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ErrorResponse("STALE_VERSION", "Saved elsewhere in the meantime", null, Instant.now()));
    }

    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<ErrorResponse> handleForbidden(ForbiddenException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ErrorResponse("FORBIDDEN", ex.getMessage(), null, Instant.now()));
    }

    @ExceptionHandler(UnknownTagException.class)
    public ResponseEntity<ErrorResponse> handleUnknownTag(UnknownTagException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ErrorResponse("UNKNOWN_TAG", ex.getMessage(), null, Instant.now()));
    }

    @ExceptionHandler(ForeignMediaException.class)
    public ResponseEntity<ErrorResponse> handleForeignMedia(ForeignMediaException ex) {
        var violation = new ErrorResponse.FieldViolation(ex.field(), ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ErrorResponse("FOREIGN_MEDIA", ex.getMessage(), List.of(violation), Instant.now()));
    }

    @ExceptionHandler(PublishValidationException.class)
    public ResponseEntity<ErrorResponse> handlePublishValidation(PublishValidationException ex) {
        var violations = ex.violations().stream()
                .map(v -> new ErrorResponse.FieldViolation(v.field(), v.message()))
                .toList();
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(new ErrorResponse("VALIDATION_FAILED", ex.getMessage(), violations, Instant.now()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        var violations = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> new ErrorResponse.FieldViolation(fe.getField(), fe.getDefaultMessage()))
                .toList();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ErrorResponse("BAD_REQUEST", "Validation failed", violations, Instant.now()));
    }

    @ExceptionHandler(UnsupportedImageException.class)
    public ResponseEntity<ErrorResponse> handleUnsupportedImage(UnsupportedImageException ex) {
        return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                .body(new ErrorResponse("UNSUPPORTED_IMAGE", ex.getMessage(), null, Instant.now()));
    }

    // Raised while the request is still being parsed, before any controller is chosen. The status
    // is a number because its constant was renamed between Spring versions.
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleUploadTooLarge(MaxUploadSizeExceededException ex) {
        return ResponseEntity.status(413)
                .body(new ErrorResponse("UPLOAD_TOO_LARGE", "The file is larger than allowed", null, Instant.now()));
    }

    @ExceptionHandler(StorageUnavailableException.class)
    public ResponseEntity<ErrorResponse> handleStorageUnavailable(StorageUnavailableException ex) {
        log.error("media upload failed", ex);
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new ErrorResponse("STORAGE_UNAVAILABLE", ex.getMessage(), null, Instant.now()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ErrorResponse("BAD_REQUEST", ex.getMessage(), null, Instant.now()));
    }

    public record ErrorResponse(String error, String message, List<FieldViolation> violations, Instant timestamp) {
        public record FieldViolation(String field, String message) {}
    }
}
