package com.tenniswire.discussion_service.service;

import static com.tenniswire.discussion_service.entity.CommentReaction.DISLIKE;
import static com.tenniswire.discussion_service.entity.CommentReaction.LIKE;
import static com.tenniswire.discussion_service.entity.CommentReaction.SLOT_EMOJI;
import static com.tenniswire.discussion_service.entity.CommentReaction.SLOT_VOTE;

import com.tenniswire.discussion_service.config.ReactionProperties;
import com.tenniswire.discussion_service.entity.Block;
import com.tenniswire.discussion_service.entity.BlockId;
import com.tenniswire.discussion_service.entity.BlockMode;
import com.tenniswire.discussion_service.entity.Comment;
import com.tenniswire.discussion_service.entity.CommentReaction;
import com.tenniswire.discussion_service.exception.CommentAlreadyRemovedException;
import com.tenniswire.discussion_service.exception.CommentDeletedException;
import com.tenniswire.discussion_service.exception.CommentingRestrictedException;
import com.tenniswire.discussion_service.exception.ForbiddenException;
import com.tenniswire.discussion_service.exception.ResourceNotFoundException;
import com.tenniswire.discussion_service.exception.UnknownReactionException;
import com.tenniswire.discussion_service.repository.BlockRepository;
import com.tenniswire.discussion_service.repository.CommentReactionRepository;
import com.tenniswire.discussion_service.repository.CommentRepository;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * One vote and one emoji per person per comment, independent of each other, each replaceable and
 * removable. Who reacted is never read back out: the rows exist to enforce the one-per-person rule
 * and to let a reaction be taken back, and the numbers people see are the counts on the comment.
 */
@Service
@Transactional
public class ReactionService {

    private final CommentRepository comments;
    private final CommentReactionRepository reactions;
    private final BlockRepository blocks;
    private final RestrictionService restrictions;
    private final AuthorTotals totals;
    private final Set<String> emoji;

    public ReactionService(
            CommentRepository comments,
            CommentReactionRepository reactions,
            BlockRepository blocks,
            RestrictionService restrictions,
            AuthorTotals totals,
            ReactionProperties properties) {
        this.comments = comments;
        this.reactions = reactions;
        this.blocks = blocks;
        this.restrictions = restrictions;
        this.totals = totals;
        this.emoji = Set.copyOf(properties.emoji());
    }

    public void setVote(UUID actorId, UUID commentId, String value) {
        if (!LIKE.equals(value) && !DISLIKE.equals(value)) {
            throw new UnknownReactionException(value);
        }
        set(actorId, commentId, SLOT_VOTE, value);
    }

    public void setEmoji(UUID actorId, UUID commentId, String value) {
        if (!emoji.contains(value)) {
            throw new UnknownReactionException(value);
        }
        set(actorId, commentId, SLOT_EMOJI, value);
    }

    public void clearVote(UUID actorId, UUID commentId) {
        clear(actorId, commentId, SLOT_VOTE);
    }

    public void clearEmoji(UUID actorId, UUID commentId) {
        clear(actorId, commentId, SLOT_EMOJI);
    }

    /**
     * What this viewer has on the comments of one page, so his own choices come back marked. Empty
     * for a reader who is not signed in, and for every comment he has not touched.
     */
    @Transactional(readOnly = true)
    public Map<UUID, ViewerReaction> of(@Nullable UUID viewerId, Collection<UUID> commentIds) {
        if (viewerId == null || commentIds.isEmpty()) {
            return Map.of();
        }
        var mine = new HashMap<UUID, ViewerReaction>();
        for (var row : reactions.findByUserIdAndCommentIdIn(viewerId, commentIds)) {
            var held = mine.getOrDefault(row.commentId(), ViewerReaction.NONE);
            mine.put(
                    row.commentId(),
                    SLOT_VOTE.equals(row.slot())
                            ? new ViewerReaction(row.value(), held.emoji())
                            : new ViewerReaction(held.vote(), row.value()));
        }
        return mine;
    }

    /**
     * Everything one person put anywhere, taken back. Used when his account goes and when a
     * permanent ban is issued with the reactions cleared. Counts on comments that are still shown
     * come down; what a removal already swept into an author's total stays there, because the
     * comment it was collected on no longer exists to take it off.
     */
    public int clearAllBy(UUID userId) {
        var mine = reactions.findByUser(userId);
        for (var reaction : mine) {
            // One at a time and in comment order: the lock is per comment, and the list is ordered
            // so that two of these running at once cross comments in the same order.
            if (comments.lockCounters(reaction.commentId()).isEmpty()) {
                continue;
            }
            comments.findById(reaction.commentId()).ifPresent(comment -> shift(comment, reaction, -1));
        }
        reactions.deleteAll(mine);
        return mine.size();
    }

    /** Every reaction on one comment, with its counts, as a removal leaves them. */
    void wipe(Comment comment) {
        totals.absorb(comment);
        reactions.deleteOn(comment.id());
    }

    void wipeAll(List<Comment> taken) {
        taken.forEach(totals::absorb);
        reactions.deleteOnAll(taken.stream().map(Comment::id).toList());
    }

    private void set(UUID actorId, UUID commentId, String slot, String value) {
        var comment = lockAndLoad(commentId);
        assertStanding(comment);
        assertTheReaderMay(actorId, comment);
        assertNotBanned(actorId);

        var existing = reactions
                .findByCommentIdAndUserIdAndSlot(commentId, actorId, slot)
                .orElse(null);
        if (existing == null) {
            var fresh = new CommentReaction()
                    .commentId(commentId)
                    .userId(actorId)
                    .slot(slot)
                    .value(value);
            reactions.save(fresh);
            shift(comment, fresh, 1);
            return;
        }
        if (value.equals(existing.value())) {
            return;
        }
        shift(comment, existing, -1);
        existing.value(value);
        shift(comment, existing, 1);
    }

    // No ban check and no ignore check: taking back one's own reaction is allowed under both, and
    // on a comment that has come down there is no row left to take back anyway.
    private void clear(UUID actorId, UUID commentId, String slot) {
        if (comments.lockCounters(commentId).isEmpty()) {
            return;
        }
        var comment = comments.findById(commentId).orElse(null);
        var existing = reactions
                .findByCommentIdAndUserIdAndSlot(commentId, actorId, slot)
                .orElse(null);
        if (comment == null || existing == null) {
            return;
        }
        shift(comment, existing, -1);
        reactions.delete(existing);
    }

    // Same gate as writing a comment: a temporary ban stops a reaction being set or changed, and
    // rules 6.10 lets it be taken back, which is why this is absent from clear().
    private void assertNotBanned(UUID actorId) {
        var active = restrictions.activeFor(actorId);
        if (!active.isEmpty()) {
            throw new CommentingRestrictedException(active.getFirst().expiresAt());
        }
    }

    private Comment lockAndLoad(UUID commentId) {
        // Before the row is read, not after: the counts this method is about to change must be the
        // ones no other writer is still changing.
        comments.lockCounters(commentId).orElseThrow(() -> new ResourceNotFoundException("Comment", commentId));
        return comments.findById(commentId).orElseThrow(() -> new ResourceNotFoundException("Comment", commentId));
    }

    private static void assertStanding(Comment comment) {
        if (comment.isHiddenByModeration()) {
            throw new CommentAlreadyRemovedException(comment.id());
        }
        if (comment.isDeleted()) {
            throw new CommentDeletedException(comment.id());
        }
    }

    private void assertTheReaderMay(UUID actorId, Comment comment) {
        if (actorId.equals(comment.authorId())) {
            throw new ForbiddenException("A comment cannot be reacted to by its own author");
        }
        // Collapsing leaves the comment reachable once expanded, and a reaction there is the
        // reader's own doing. The other two modes put it out of his reach entirely.
        var mode = blocks.findById(new BlockId(actorId, comment.authorId()))
                .map(Block::mode)
                .orElse(null);
        if (mode != null && mode != BlockMode.SOFT) {
            throw new ForbiddenException("An ignored author's comment cannot be reacted to in this mode");
        }
    }

    private static void shift(Comment comment, CommentReaction reaction, int delta) {
        if (SLOT_VOTE.equals(reaction.slot())) {
            if (LIKE.equals(reaction.value())) {
                comment.likeCount(Math.max(comment.likeCount() + delta, 0));
            } else {
                comment.dislikeCount(Math.max(comment.dislikeCount() + delta, 0));
            }
            return;
        }
        // Replaced whole rather than edited in place: a JSON column is compared by value, and a map
        // changed under Hibernate's feet is not always seen as changed.
        var counts = new HashMap<>(comment.emojiCounts());
        var next = counts.getOrDefault(reaction.value(), 0) + delta;
        if (next <= 0) {
            counts.remove(reaction.value());
        } else {
            counts.put(reaction.value(), next);
        }
        comment.emojiCounts(counts);
    }
}
