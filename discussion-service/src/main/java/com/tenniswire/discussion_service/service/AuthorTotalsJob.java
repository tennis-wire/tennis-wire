package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.config.AuthorTotalsProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

// Runs on every instance; the batches take turns on a lock of their own
@Component
@EnableScheduling
@ConditionalOnProperty(
        prefix = "discussion.author-totals",
        name = "enabled",
        havingValue = "true",
        matchIfMissing = true)
@Slf4j
class AuthorTotalsJob {

    private final AuthorTotals totals;
    private final AuthorTotalsProperties properties;

    AuthorTotalsJob(AuthorTotals totals, AuthorTotalsProperties properties) {
        this.totals = totals;
        this.properties = properties;
    }

    // No line on a pass that went well: it runs every minute, and the lag is read off the table
    @Scheduled(fixedDelayString = "${discussion.author-totals.interval}")
    public void pass() {
        var size = properties.batchSize();
        var folded = 0;
        try {
            int batch;
            do {
                batch = totals.fold(size).orElse(0);
                folded += batch;
            } while (batch == size);
        } catch (RuntimeException e) {
            log.warn("author totals pass stopped after {} changes: {}", folded, e.getMessage());
        }
    }
}
