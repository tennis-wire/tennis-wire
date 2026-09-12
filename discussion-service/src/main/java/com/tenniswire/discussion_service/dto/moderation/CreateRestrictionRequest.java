package com.tenniswire.discussion_service.dto.moderation;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

/** @param expiresAt {@code null} for an indefinite (but still comment-only) restriction */
public record CreateRestrictionRequest(
        @NotNull UUID userId,
        Instant expiresAt,
        @Size(max = 1000) String reason) {}
