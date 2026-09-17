package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.config.TextExpiryProperties;
import java.time.Instant;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

// Runs on every instance; the batches take turns on a lock of their own
@Component
@EnableScheduling
@ConditionalOnProperty(prefix = "discussion.text-expiry", name = "enabled", havingValue = "true", matchIfMissing = true)
@Slf4j
class TextExpiryJob {

    private final TextExpiryWriter writer;
    private final TextExpiryProperties properties;

    TextExpiryJob(TextExpiryWriter writer, TextExpiryProperties properties) {
        this.writer = writer;
        this.properties = properties;
    }

    @Scheduled(fixedDelayString = "${discussion.text-expiry.interval}")
    public void pass() {
        // The JVM clock: deleted_at is written by it
        var cutoff = Instant.now().minus(properties.after());
        var size = properties.batchSize();
        var due = 0;
        try {
            int batch;
            do {
                batch = writer.erase(cutoff, size).orElse(0);
                due += batch;
            } while (batch == size);
            if (due > 0) {
                log.info("text expiry pass: {} comments past their term", due);
            }
        } catch (RuntimeException e) {
            log.warn("text expiry pass stopped after {} comments: {}", due, e.getMessage());
        }
    }
}
