package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.entity.Block;
import com.tenniswire.discussion_service.entity.BlockId;
import com.tenniswire.discussion_service.entity.BlockMode;
import com.tenniswire.discussion_service.entity.Comment;
import com.tenniswire.discussion_service.entity.ReportResolution;
import com.tenniswire.discussion_service.entity.UserRestriction;
import com.tenniswire.discussion_service.event.CommentCreatedEvent;
import com.tenniswire.discussion_service.event.DomainEventPublisher;
import com.tenniswire.discussion_service.exception.CommentingRestrictedException;
import com.tenniswire.discussion_service.exception.ForbiddenException;
import com.tenniswire.discussion_service.exception.ResolutionNotApplicableException;
import com.tenniswire.discussion_service.exception.ResourceNotFoundException;
import com.tenniswire.discussion_service.repository.BlockRepository;
import com.tenniswire.discussion_service.repository.CommentRepository;
import com.tenniswire.discussion_service.repository.ReportRepository;
import com.tenniswire.discussion_service.repository.UserRestrictionRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class CommentService {

    private final CommentRepository comments;
    private final BlockRepository blocks;
    private final UserRestrictionRepository restrictions;
    private final ReportRepository reports;
    private final DomainEventPublisher events;

    public CommentService(
            CommentRepository comments,
            BlockRepository blocks,
            UserRestrictionRepository restrictions,
            ReportRepository reports,
            DomainEventPublisher events) {
        this.comments = comments;
        this.blocks = blocks;
        this.restrictions = restrictions;
        this.reports = reports;
        this.events = events;
    }

    // -- Write path (spec §9) --

    public CreatedComment create(UUID authorId, String subjectType, UUID subjectId, String body) {
        assertMayComment(authorId);

        var comment = new Comment()
                .subjectType(subjectType)
                .subjectId(subjectId)
                .authorId(authorId)
                .body(body);
        // flush now: path, root_id and the timestamps come back from the INSERT ... RETURNING
        var saved = comments.saveAndFlush(comment);

        events.publish(toEvent(saved));
        return new CreatedComment(saved, false);
    }

    public CreatedComment reply(UUID authorId, UUID parentId, String body) {
        assertMayComment(authorId);
        // A soft-deleted parent still accepts replies: the node is kept for exactly that reason.
        var parent = findOrThrow(parentId);

        var comment = new Comment()
                .subjectType(parent.subjectType())
                .subjectId(parent.subjectId())
                .inReplyToId(parent.id())
                .authorId(authorId)
                .body(body);
        var saved = comments.saveAndFlush(comment);
        comments.incrementReplyCount(parent.id());

        var muted = blocks.existsById(new BlockId(parent.authorId(), authorId));
        events.publish(toEvent(saved));
        return new CreatedComment(saved, muted);
    }

    /** Soft delete by the author. Idempotent. */
    public void deleteOwn(UUID actorId, UUID commentId) {
        var comment = findOrThrow(commentId);
        if (!comment.authorId().equals(actorId)) {
            throw new ForbiddenException("Not the author of comment " + commentId);
        }
        softDelete(comment);
    }

    /**
     * Removal by a person. Idempotent, and refused on a comment its author already took down:
     * moderation has nothing left to remove there, only a violation it may still count.
     */
    public void hideByModerator(UUID commentId, UUID moderatorId) {
        hide(findOrThrow(commentId), Comment.HIDDEN_BY_MODERATOR, moderatorId);
    }

    /** Removal by the classifier. It has no reader profile, so the row records only that it acted. */
    public void hideByBot(UUID commentId) {
        hide(findOrThrow(commentId), Comment.HIDDEN_BY_BOT, null);
    }

    // -- Read path (spec §10): dumb queries, tree in memory, block modes applied per viewer --

    @Transactional(readOnly = true)
    public List<CommentView> listTopLevel(String subjectType, UUID subjectId, @Nullable UUID viewerId) {
        var rows = comments.findBySubjectTypeAndSubjectIdAndInReplyToIdIsNullOrderByCreatedAtAscIdAsc(
                subjectType, subjectId);
        return BlockRenderPolicy.apply(CommentTree.forest(rows), blocksOf(viewerId));
    }

    /** The comment with its whole subtree, or 404 when the viewer has removed the branch head. */
    @Transactional(readOnly = true)
    public CommentView branch(UUID commentId, @Nullable UUID viewerId) {
        var head = findOrThrow(commentId);
        var tree = CommentTree.forest(comments.findSubtree(head.path()));
        // findSubtree returns head plus descendants, so the forest has exactly one root
        return BlockRenderPolicy.apply(tree.getFirst(), blocksOf(viewerId))
                .orElseThrow(() -> new ResourceNotFoundException("Comment", commentId));
    }

    /**
     * Root first, the requested comment last, no replies attached. A subtree_removal block on any
     * ancestor hides the whole chain, so the comment is 404 for that viewer, as it would be in the
     * thread itself.
     */
    @Transactional(readOnly = true)
    public List<CommentView> ancestry(UUID commentId, @Nullable UUID viewerId) {
        var target = findOrThrow(commentId);
        var chain = CommentTree.forest(comments.findAncestry(target.path()));
        // the ancestry is one linear tree rooted at the thread root
        var flat = new ArrayList<CommentView>();
        var cursor =
                BlockRenderPolicy.apply(chain.getFirst(), blocksOf(viewerId)).orElse(null);
        while (cursor != null) {
            flat.add(new CommentView(cursor.comment(), cursor.visibility(), List.of()));
            cursor = cursor.replies().isEmpty() ? null : cursor.replies().getFirst();
        }
        if (flat.isEmpty() || !flat.getLast().comment().id().equals(commentId)) {
            throw new ResourceNotFoundException("Comment", commentId);
        }
        return flat;
    }

    // -- Helpers --

    private void assertMayComment(UUID authorId) {
        var active = restrictions.findActive(authorId, UserRestriction.CAPABILITY_COMMENT, Instant.now());
        if (!active.isEmpty()) {
            // ordered indefinite-first, then latest expiry: the first row is the binding one
            throw new CommentingRestrictedException(active.getFirst().expiresAt());
        }
    }

    private void softDelete(Comment comment) {
        if (!comment.isDeleted()) {
            comment.deletedAt(Instant.now());
        }
    }

    private void hide(Comment comment, String source, @Nullable UUID moderatorId) {
        if (comment.isHiddenByModeration()) {
            return;
        }
        if (comment.isDeleted()) {
            throw new ResolutionNotApplicableException(
                    "Comment " + comment.id() + " was deleted by its author and is not moderation's to remove");
        }
        var now = Instant.now();
        comment.deletedAt(now).hiddenAt(now).hiddenSource(source).hiddenBy(moderatorId);
        // However the comment came down, the queue is done with it — including when it was taken
        // down straight from the comment endpoint, with no card ever opened.
        reports.closeOpen(comment.id(), ReportResolution.HIDDEN, moderatorId);
    }

    private Map<UUID, BlockMode> blocksOf(@Nullable UUID viewerId) {
        if (viewerId == null) {
            return Map.of();
        }
        return blocks.findByIdBlockerIdOrderByCreatedAtAsc(viewerId).stream()
                .collect(Collectors.toMap(b -> b.id().blockedId(), Block::mode, (a, b) -> a));
    }

    private Comment findOrThrow(UUID id) {
        return comments.findById(id).orElseThrow(() -> new ResourceNotFoundException("Comment", id));
    }

    private static CommentCreatedEvent toEvent(Comment c) {
        return new CommentCreatedEvent(
                c.id(), c.subjectType(), c.subjectId(), c.rootId(), c.inReplyToId(), c.authorId(), c.createdAt());
    }
}
