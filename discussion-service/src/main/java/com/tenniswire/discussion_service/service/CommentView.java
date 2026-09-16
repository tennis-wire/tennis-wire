package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.entity.Comment;
import java.util.List;

/**
 * A node as one particular viewer is allowed to see it. {@code replyCount} is the direct replies he
 * gets, without the ones his own subtree_removal takes out; {@code repliesTruncated} says the service
 * held back some of those.
 */
public record CommentView(
        Comment comment, Visibility visibility, int replyCount, boolean repliesTruncated, List<CommentView> replies) {}
