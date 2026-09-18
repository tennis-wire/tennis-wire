package com.tenniswire.discussion_service.repository;

import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** What one comment's earliest open report was filed against; {@code body} is null unless edited. */
public record ReportedBody(UUID commentId, @Nullable String body) {}
