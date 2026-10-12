package com.tenniswire.editorial_bff.ai;

import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.errors.RateLimitException;
import com.anthropic.errors.UnauthorizedException;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackageClasses = AiChatController.class)
@Slf4j
public class AiErrorHandler {

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
        log.error("Claude API error: status={}", ex.statusCode(), ex);
        return error(HttpStatus.BAD_GATEWAY, "AI-сервис временно недоступен. Попробуйте позже.");
    }

    private ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(Map.of("error", status.getReasonPhrase(), "message", message));
    }
}
