package com.tenniswire.discussion_service.dto.reader;

import java.util.List;

/** Permalink support: the thread root first, the requested comment last. */
public record AncestryResponse(List<CommentResponse> chain) {}
