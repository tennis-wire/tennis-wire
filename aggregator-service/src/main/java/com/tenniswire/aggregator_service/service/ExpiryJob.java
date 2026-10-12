package com.tenniswire.aggregator_service.service;

import com.tenniswire.aggregator_service.config.ExpiryProperties;
import java.time.Instant;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

// A working feed, not an archive: an item goes whole after its term (aggregator.md 5.1). Runs on
// every instance; the batches take turns on a lock of their own.
@Component
@EnableScheduling
@ConditionalOnProperty(prefix = "aggregator.expiry", name = "enabled", havingValue = "true", matchIfMissing = true)
@Slf4j
public class ExpiryJob {

    private final ExpiryWriter writer;
    private final ExpiryProperties properties;

    ExpiryJob(ExpiryWriter writer, ExpiryProperties properties) {
        this.writer = writer;
        this.properties = properties;
    }

    @Scheduled(fixedDelayString = "${aggregator.expiry.interval}")
    public void pass() {
        // The database clock writes created_at; the JVM's is close enough for a term of days
        var cutoff = Instant.now().minus(properties.after());
        var size = properties.batchSize();
        var deleted = 0;
        try {
            int batch;
            do {
                batch = writer.delete(cutoff, size).orElse(0);
                deleted += batch;
            } while (batch == size);
            if (deleted > 0) {
                log.info("expiry pass: {} items past their term deleted", deleted);
            }
        } catch (RuntimeException e) {
            log.warn("expiry pass stopped after {} items: {}", deleted, e.getMessage());
        }
    }
}
