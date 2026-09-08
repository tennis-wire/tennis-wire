package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.entity.Comment;
import java.util.List;

/** A node as one particular viewer is allowed to see it. */
public record CommentView(Comment comment, Visibility visibility, List<CommentView> replies) {}
