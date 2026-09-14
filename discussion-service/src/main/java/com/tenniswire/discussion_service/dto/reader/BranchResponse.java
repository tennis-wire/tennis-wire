package com.tenniswire.discussion_service.dto.reader;

/**
 * A comment with its subtree nested under {@code root.replies}, cut to five levels and twenty
 * direct replies a node. Nothing here is a dead end: a node marked {@code repliesTruncated} is read
 * on through {@code GET /comments/&#123;id&#125;/replies}, and a node at the bottom opens a branch
 * of its own.
 */
public record BranchResponse(CommentResponse root) {}
