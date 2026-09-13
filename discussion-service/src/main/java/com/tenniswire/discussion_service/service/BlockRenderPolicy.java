package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.entity.BlockMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * The three render modes of the spec §7, applied in memory over a loaded tree.
 *
 * <p>Precedence per node: subtree_removal drops the node and everything under it, deletion beats
 * the two "keep the children" modes (there is no body to hide either way), then gravestone, then
 * soft. Nothing here rejects a write: the blocked author's replies are stored and shown to
 * everyone else.
 */
public final class BlockRenderPolicy {

    private BlockRenderPolicy() {}

    /** @param blocks the viewer's blocks, keyed by blocked author id; empty for an anonymous viewer */
    public static List<CommentView> apply(List<CommentNode> nodes, Map<UUID, BlockMode> blocks) {
        var out = new ArrayList<CommentView>(nodes.size());
        for (var node : nodes) {
            apply(node, blocks).ifPresent(out::add);
        }
        return out;
    }

    /** Empty when the node is removed for this viewer. */
    public static Optional<CommentView> apply(CommentNode node, Map<UUID, BlockMode> blocks) {
        var comment = node.comment();
        // A comment whose author erased his account belongs to nobody, so no block bears on it.
        // Asked rather than looked up: an anonymous viewer's map is Map.of(), which throws on a
        // null key instead of missing.
        var mode = comment.hasNoAuthor() ? null : blocks.get(comment.authorId());
        if (mode == BlockMode.SUBTREE_REMOVAL) {
            return Optional.empty();
        }
        var visibility = Visibility.VISIBLE;
        if (comment.isDeleted()) {
            visibility = Visibility.DELETED;
        } else if (mode == BlockMode.GRAVESTONE) {
            visibility = Visibility.GRAVESTONE;
        } else if (mode == BlockMode.SOFT) {
            visibility = Visibility.SOFT_HIDDEN;
        }
        return Optional.of(new CommentView(comment, visibility, apply(node.children(), blocks)));
    }
}
