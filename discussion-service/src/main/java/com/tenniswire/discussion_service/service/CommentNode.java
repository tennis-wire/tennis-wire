package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.entity.Comment;
import java.util.ArrayList;
import java.util.List;

/** A comment with its direct replies, as assembled from a flat result set. Untouched by block rules. */
public final class CommentNode {

    private final Comment comment;
    private final List<CommentNode> children = new ArrayList<>();

    CommentNode(Comment comment) {
        this.comment = comment;
    }

    public Comment comment() {
        return comment;
    }

    public List<CommentNode> children() {
        return children;
    }
}
