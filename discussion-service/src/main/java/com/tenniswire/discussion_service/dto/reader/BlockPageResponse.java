package com.tenniswire.discussion_service.dto.reader;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record BlockPageResponse(
        List<BlockResponse> items, @Nullable String nextCursor) {}
