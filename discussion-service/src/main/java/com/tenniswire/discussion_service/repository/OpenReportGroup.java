package com.tenniswire.discussion_service.repository;

import java.time.Instant;
import java.util.UUID;

public record OpenReportGroup(UUID commentId, Long reportCount, Instant firstReportedAt, Instant lastReportedAt) {}
