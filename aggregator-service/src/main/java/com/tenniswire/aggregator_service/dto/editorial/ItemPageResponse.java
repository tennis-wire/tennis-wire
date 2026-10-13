package com.tenniswire.aggregator_service.dto.editorial;

import java.util.List;
import org.jspecify.annotations.Nullable;

// nextCursor is null on the last page
public record ItemPageResponse(
        List<ItemCardResponse> items, @Nullable String nextCursor) {}
