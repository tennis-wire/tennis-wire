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
        return forest(comments, Integer.MAX_VALUE);
    }

    /**
     * @param maxChildren how many direct replies a node may carry; the rest are dropped, oldest
     *     kept, and the node is marked so the caller can be told where to ask for the remainder
     */
    static List<CommentNode> forest(List<Comment> comments, int maxChildren) {
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
            if (node.children().size() > maxChildren) {
                node.children().subList(maxChildren, node.children().size()).clear();
            }
            // One rule for every caller: the node is marked when the service is handing over fewer
            // direct replies than the comment has. That covers the width cap here, the depth cap
            // that kept the deepest rows out of the result set, and the endpoints that return no
            // replies at all. Blocks are deliberately out of view — they are applied after this,
            // and what a viewer removed for himself is not something we withheld from him.
            node.repliesTruncated(node.children().size() < node.comment().replyCount());
        }
        roots.sort(OLDEST_FIRST);
        return roots;
    }
}
