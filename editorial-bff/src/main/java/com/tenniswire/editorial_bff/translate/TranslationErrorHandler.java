package com.tenniswire.editorial_bff.translate;

import com.deepl.api.DeepLClient;
import com.deepl.api.DeepLException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.util.Map;

@RestControllerAdvice(basePackageClasses = TranslationController.class)
@ConditionalOnBean(DeepLClient.class)
public class TranslationErrorHandler {

    private static final Logger log = LoggerFactory.getLogger(TranslationErrorHandler.class);

    @ExceptionHandler(DeepLException.class)
    public ResponseEntity<Map<String, String>> handleDeepLError(DeepLException ex) {
        log.error("DeepL API error: {}", ex.getMessage());

        // DeepLException doesn't expose HTTP status directly,
        // but the message often contains "Too many requests" or "Quota exceeded"
        HttpStatus status;
        String message;

        if (ex.getMessage() != null && ex.getMessage().contains("Too many requests")) {
            status = HttpStatus.TOO_MANY_REQUESTS;
            message = "Слишком много запросов к сервису перевода. Попробуйте позже.";
        } else if (ex.getMessage() != null && ex.getMessage().contains("Quota")) {
            status = HttpStatus.TOO_MANY_REQUESTS;
            message = "Лимит переводов исчерпан.";
        } else {
            status = HttpStatus.BAD_GATEWAY;
            message = "Сервис перевода временно недоступен. Попробуйте позже.";
        }

        return ResponseEntity
            .status(status)
            .body(Map.of("error", status.getReasonPhrase(), "message", message));
    }

    @ExceptionHandler(InterruptedException.class)
    public ResponseEntity<Map<String, String>> handleInterrupted(InterruptedException ex) {
        log.warn("Translation interrupted: {}", ex.getMessage());
        Thread.currentThread().interrupt();
        return ResponseEntity
            .status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(Map.of(
                "error", "Service Unavailable",
                "message", "Перевод был прерван. Попробуйте ещё раз."));
    }
}
