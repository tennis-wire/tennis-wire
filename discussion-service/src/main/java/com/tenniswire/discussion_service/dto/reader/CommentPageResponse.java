package com.tenniswire.discussion_service.dto.reader;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import org.jspecify.annotations.Nullable;

public record CommentPageResponse(
        List<CommentResponse> items,
        @Nullable String nextCursor,
        // On the listing, for a signed-in reader. A page of replies does not open a thread and leaves it out.
        @JsonInclude(JsonInclude.Include.NON_NULL) @Nullable ViewerResponse viewer) {}
