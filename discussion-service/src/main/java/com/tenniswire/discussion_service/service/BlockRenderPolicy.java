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
 * <p>Precedence per node: subtree_removal drops the node and everything under it, a comment that
 * is down beats the two "keep the children" modes (there is no body to hide either way), then
 * gravestone, then soft. Nothing here rejects a write: the blocked author's replies are stored and
 * shown to everyone else.
 *
 * <p>The reply count is the viewer's too. The tree holds only the rows that were loaded, so what his
 * subtree_removal takes off each count is counted in the database and passed in.
 */
public final class BlockRenderPolicy {

    private BlockRenderPolicy() {}

    /**
     * @param blocks the viewer's blocks, keyed by blocked author id; empty for an anonymous viewer
     * @param removedReplies per comment id, how many of its counted direct replies the viewer removes
     *     with their branches; no entry where none
     */
    public static List<CommentView> apply(
            List<CommentNode> nodes, Map<UUID, BlockMode> blocks, Map<UUID, Integer> removedReplies) {
        var out = new ArrayList<CommentView>(nodes.size());
        for (var node : nodes) {
            apply(node, blocks, removedReplies).ifPresent(out::add);
        }
        return out;
    }

    /** Empty when the node is removed for this viewer. */
    public static Optional<CommentView> apply(
            CommentNode node, Map<UUID, BlockMode> blocks, Map<UUID, Integer> removedReplies) {
        var comment = node.comment();
        // A comment whose author erased his account belongs to nobody, so no block bears on it.
        // Asked rather than looked up: an anonymous viewer's map is Map.of(), which throws on a
        // null key instead of missing.
        var mode = comment.hasNoAuthor() ? null : blocks.get(comment.authorId());
        if (mode == BlockMode.SUBTREE_REMOVAL) {
            return Optional.empty();
        }
        // Direct replies only: a reply that is a placeholder with everything under it removed for
        // this viewer still counts. Floored, since the raw count is maintained, not recomputed.
        var replyCount = Math.max(0, comment.replyCount() - removedReplies.getOrDefault(comment.id(), 0));
        // A placeholder stands while something is shown under it, and to this viewer nothing is
        if (comment.isDeleted() && replyCount == 0) {
            return Optional.empty();
        }
        var visibility = Visibility.VISIBLE;
        // Moderation first: its removal sets deletedAt as well, and the placeholder must say
        // which of the two it was. An erased account leaves that mark alone (§13.7).
        if (comment.isHiddenByModeration()) {
            visibility = Visibility.REMOVED;
        } else if (comment.isDeleted()) {
            visibility = Visibility.DELETED;
        } else if (mode == BlockMode.GRAVESTONE) {
            visibility = Visibility.GRAVESTONE;
        } else if (mode == BlockMode.SOFT) {
            visibility = Visibility.SOFT_HIDDEN;
        }
        var replies = apply(node.children(), blocks, removedReplies);
        // Held back by the service, and not only what the viewer removed himself: if everything
        // left out is his own doing, there is nothing more for him to ask for
        var repliesTruncated = node.repliesTruncated() && replies.size() < replyCount;
        return Optional.of(new CommentView(comment, visibility, replyCount, repliesTruncated, replies));
    }
}
