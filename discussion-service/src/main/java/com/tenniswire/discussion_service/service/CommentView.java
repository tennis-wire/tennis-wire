package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.entity.Comment;
import java.util.List;

/**
 * A node as one particular viewer is allowed to see it. {@code repliesTruncated} says the service
 * held back direct replies that exist; it never reflects what this viewer's own blocks removed.
 */
public record CommentView(
        Comment comment, Visibility visibility, boolean repliesTruncated, List<CommentView> replies) {}
