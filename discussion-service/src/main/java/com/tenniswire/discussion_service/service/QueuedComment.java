package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.entity.Comment;
import java.time.Instant;
import java.util.Map;
import org.jspecify.annotations.Nullable;

// bodyAtFirstReport is null unless the author rewrote the comment after it was reported; then it is
// the text the earliest open report was filed against.
public record QueuedComment(
        Comment comment,
        @Nullable String bodyAtFirstReport,
        long reportCount,
        Instant firstReportedAt,
        Instant lastReportedAt,
        Map<String, Long> reasons,
        boolean fromBot) {}
