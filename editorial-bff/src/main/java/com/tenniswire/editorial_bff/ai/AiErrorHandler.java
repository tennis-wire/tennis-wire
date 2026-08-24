package com.tenniswire.editorial_bff.ai;

import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.errors.RateLimitException;
import com.anthropic.errors.UnauthorizedException;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackageClasses = AiChatController.class)
public class AiErrorHandler {

    private static final Logger log = LoggerFactory.getLogger(AiErrorHandler.class);

    @ExceptionHandler(RateLimitException.class)
    public ResponseEntity<Map<String, String>> handleRateLimit(RateLimitException ex) {
        log.warn("Claude API rate limit exceeded");
        return error(HttpStatus.TOO_MANY_REQUESTS, "Слишком много запросов. Подождите немного.");
    }

    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<Map<String, String>> handleUnauthorized(UnauthorizedException ex) {
        log.error("Claude API key is invalid or missing");
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "AI-сервис временно недоступен.");
    }

    @ExceptionHandler(AnthropicServiceException.class)
    public ResponseEntity<Map<String, String>> handleAnthropicError(AnthropicServiceException ex) {
        log.error("Claude API error: {} {}", ex.statusCode(), ex.getMessage());
        return error(HttpStatus.BAD_GATEWAY, "AI-сервис временно недоступен. Попробуйте позже.");
    }

    private ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(Map.of("error", status.getReasonPhrase(), "message", message));
    }
}
