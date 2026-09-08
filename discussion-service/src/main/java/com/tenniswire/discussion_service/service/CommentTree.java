package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.entity.Comment;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;

/**
 * Builds trees from flat lists. Two passes, so the input order does not matter; children end up
 * oldest-first regardless of how the query sorted them.
 */
final class CommentTree {

    private static final Comparator<CommentNode> OLDEST_FIRST = Comparator.comparing(
                    (CommentNode n) -> n.comment().createdAt())
            .thenComparing(n -> n.comment().id());

    private CommentTree() {}

    /** Roots are the nodes whose parent is not in the list — top-level comments, or the branch head. */
    static List<CommentNode> forest(List<Comment> comments) {
        var nodes = new LinkedHashMap<UUID, CommentNode>();
        for (var comment : comments) {
            nodes.put(comment.id(), new CommentNode(comment));
        }
        var roots = new ArrayList<CommentNode>();
        for (var node : nodes.values()) {
            var parent = node.comment().inReplyToId() == null
                    ? null
                    : nodes.get(node.comment().inReplyToId());
            if (parent == null) {
                roots.add(node);
            } else {
                parent.children().add(node);
            }
        }
        for (var node : nodes.values()) {
            node.children().sort(OLDEST_FIRST);
        }
        roots.sort(OLDEST_FIRST);
        return roots;
    }
}
