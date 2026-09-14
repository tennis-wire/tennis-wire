package com.tenniswire.discussion_service.dto.reader;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record CommentPageResponse(
        List<CommentResponse> items, @Nullable String nextCursor) {}
