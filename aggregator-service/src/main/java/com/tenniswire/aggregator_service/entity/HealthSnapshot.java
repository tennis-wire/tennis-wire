package com.tenniswire.aggregator_service.entity;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;

// A source's health as the collector judged it (aggregator.md 4.11), stored as it came: the
// collector counts, this service keeps the latest word for the feed
public record HealthSnapshot(
        @NotNull @Size(max = 10) @Valid List<Problem> problems,
        Instant lastRunAt,
        @Size(max = 50) String lastStatus,
        Instant lastOkAt,
        Instant lastNewAt,
        @PositiveOrZero int failuresInRow,
        Instant blockedSince,
        @Size(max = 50) String blockKind) {

    public record Problem(
            @NotNull @Size(max = 50) String kind,
            @Size(max = 500) String detail) {}
}
