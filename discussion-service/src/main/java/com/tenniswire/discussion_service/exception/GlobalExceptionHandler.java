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

    @ExceptionHandler(HiddenByBlockException.class)
    public ResponseEntity<ErrorResponse> handleHiddenByBlock(HiddenByBlockException ex) {
        // 404, so a client reading only the status still says "not found"; the ids tell a client
        // that knows better whose block to offer to change
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse(
                        "HIDDEN_BY_BLOCK",
                        ex.getMessage(),
                        null,
                        Map.of("blockedIds", ex.blockedIds()),
                        Instant.now()));
    }

    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleUserNotFound(UserNotFoundException ex) {
        // Not NOT_FOUND: on the same path that means there is no block, here the person is missing
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse.of("USER_NOT_FOUND", ex.getMessage()));
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

    @ExceptionHandler(PollClosedException.class)
    public ResponseEntity<ErrorResponse> handlePollClosed(PollClosedException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorResponse.of("POLL_CLOSED", ex.getMessage()));
    }

    @ExceptionHandler(UnknownReactionException.class)
    public ResponseEntity<ErrorResponse> handleUnknownReaction(UnknownReactionException ex) {
        return ResponseEntity.badRequest().body(ErrorResponse.of("UNKNOWN_REACTION", ex.getMessage()));
    }

    @ExceptionHandler(CommentDeletedException.class)
    public ResponseEntity<ErrorResponse> handleCommentDeleted(CommentDeletedException ex) {
        // Told apart from COMMENT_ALREADY_REMOVED because the rules give the author two wordings:
        // one for a comment he took down himself, another for one moderation removed.
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorResponse.of("COMMENT_DELETED", ex.getMessage()));
    }

    @ExceptionHandler(EditWindowClosedException.class)
    public ResponseEntity<ErrorResponse> handleEditWindowClosed(EditWindowClosedException ex) {
        // 403 rather than 409: nothing about the comment changed, the author simply may no longer
        // do this. The client keeps his text in the field so he can copy it out.
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ErrorResponse.of("EDIT_WINDOW_CLOSED", ex.getMessage()));
    }

    @ExceptionHandler(ParentDeletedException.class)
    public ResponseEntity<ErrorResponse> handleParentDeleted(ParentDeletedException ex) {
        // 409 rather than 404: the node may well still be there carrying other replies, and what
        // the request conflicts with is its being down. The client keeps the text and offers to
        // post it as a comment of its own.
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorResponse.of("PARENT_DELETED", ex.getMessage()));
    }

    @ExceptionHandler(IdempotencyKeyReusedException.class)
    public ResponseEntity<ErrorResponse> handleIdempotencyKeyReused(IdempotencyKeyReusedException ex) {
        // 422 rather than 409: nothing about the comment stands in the way. The request itself is not
        // the one the key was first sent with, and the comment written then is not this one.
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_CONTENT)
                .body(ErrorResponse.of("IDEMPOTENCY_KEY_REUSED", ex.getMessage()));
    }

    @ExceptionHandler(ResolutionNotApplicableException.class)
    public ResponseEntity<ErrorResponse> handleResolution(ResolutionNotApplicableException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ErrorResponse.of("RESOLUTION_NOT_APPLICABLE", ex.getMessage()));
    }

    @ExceptionHandler(BlockListFullException.class)
    public ResponseEntity<ErrorResponse> handleBlockListFull(BlockListFullException ex) {
        // details.limit, so the client says how many without keeping a copy of the number
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ErrorResponse(
                        "BLOCK_LIST_FULL", ex.getMessage(), null, Map.of("limit", ex.limit()), Instant.now()));
    }

    @ExceptionHandler(UnknownSubjectTypeException.class)
    public ResponseEntity<ErrorResponse> handleUnknownSubjectType(UnknownSubjectTypeException ex) {
        // 400 rather than 404: nothing was looked up. The set is configuration, so a client sending
        // a type we do not serve is wrong about the API rather than about a thing that is missing.
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ErrorResponse.of("UNKNOWN_SUBJECT_TYPE", ex.getMessage()));
    }

    @ExceptionHandler(InvalidCursorException.class)
    public ResponseEntity<ErrorResponse> handleInvalidCursor(InvalidCursorException ex) {
        // A cursor is opaque and always ours, so a broken one is a client that built its own or
        // kept one across a change of format. Silence would look like the end of the thread.
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorResponse.of("INVALID_CURSOR", ex.getMessage()));
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
