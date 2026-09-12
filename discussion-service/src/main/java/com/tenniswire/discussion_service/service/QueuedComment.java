package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.entity.Comment;
import java.time.Instant;
import java.util.Map;

public record QueuedComment(
        Comment comment,
        long reportCount,
        Instant firstReportedAt,
        Instant lastReportedAt,
        Map<String, Long> reasons,
        boolean fromBot) {}
