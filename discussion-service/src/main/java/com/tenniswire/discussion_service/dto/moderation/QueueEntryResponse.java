package com.tenniswire.discussion_service.dto.moderation;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

public record QueueEntryResponse(
        UUID commentId,
        String subjectType,
        UUID subjectId,
        UUID rootId,
        String body,
        boolean deletedByAuthor,
        QueueAuthor author,
        long reportCount,
        Map<String, Long> reasons,
        boolean fromBot,
        Instant firstReportedAt,
        Instant lastReportedAt) {

    public record QueueAuthor(
            UUID id,
            @Nullable String displayName,
            @Nullable String avatarUrl,
            @Nullable ActiveRestriction restriction,
            RemovalCounts removedByModerator,
            RemovalCounts removedByBot) {}

    public record ActiveRestriction(@Nullable Instant expiresAt) {}

    public record RemovalCounts(long last30Days, long total) {

        public static final RemovalCounts NONE = new RemovalCounts(0, 0);
    }
}
