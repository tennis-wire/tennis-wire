package com.tenniswire.discussion_service.repository;

import java.util.UUID;

public record ReasonTally(UUID commentId, String reason, String source, Long count) {}
