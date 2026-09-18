package com.tenniswire.discussion_service.dto.moderation;

import com.fasterxml.jackson.annotation.JsonInclude;
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
        // Absent unless the author rewrote the comment after it was reported. Where it is present,
        // it is what the complaint was about and body is what stands there now.
        @JsonInclude(JsonInclude.Include.NON_NULL) @Nullable String bodyAtFirstReport,
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
