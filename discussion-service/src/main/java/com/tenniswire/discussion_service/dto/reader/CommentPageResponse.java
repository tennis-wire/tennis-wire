package com.tenniswire.discussion_service.dto.reader;

import java.util.List;

/**
 * Paged from day one (spec §10): {@code nextCursor} is always {@code null} until keyset pagination
 * lands, and the client must already treat a non-null value as "there is more".
 */
public record CommentPageResponse(List<CommentResponse> items, String nextCursor) {

    public static CommentPageResponse unpaged(List<CommentResponse> items) {
        return new CommentPageResponse(items, null);
    }
}
