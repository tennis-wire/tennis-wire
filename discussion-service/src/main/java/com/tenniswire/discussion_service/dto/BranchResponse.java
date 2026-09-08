package com.tenniswire.discussion_service.dto;

/** A comment with its subtree nested under {@code root.replies}. Cursor semantics as in {@link CommentPageResponse}. */
public record BranchResponse(CommentResponse root, String nextCursor) {}
