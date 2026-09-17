package com.tenniswire.discussion_service.dto.reader;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import org.jspecify.annotations.Nullable;

/** Permalink support: the thread root first, the requested comment last. */
public record AncestryResponse(
        List<CommentResponse> chain,
        // A link opens the thread here rather than at the listing, so the reader's standing comes here too
        @JsonInclude(JsonInclude.Include.NON_NULL) @Nullable ViewerResponse viewer) {}
