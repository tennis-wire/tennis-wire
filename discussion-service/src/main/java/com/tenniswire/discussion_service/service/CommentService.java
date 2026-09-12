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
import com.tenniswire.discussion_service.repository.ChildTally;
import com.tenniswire.discussion_service.repository.CommentRepository;
import com.tenniswire.discussion_service.repository.ReportRepository;
import com.tenniswire.discussion_service.repository.UserRestrictionRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
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

        // Nobody is left to have blocked him once the parent's author has erased his account.
        var muted = !parent.hasNoAuthor() && blocks.existsById(new BlockId(parent.authorId(), authorId));
        events.publish(toEvent(saved));
        return new CreatedComment(saved, muted);
    }

    /**
     * Deletion by the author. The node is marked deleted and then, if nothing stands on it, taken
     * away outright along with every gravestone above it that it was the last thing holding up
     * (discussion-rules §8.5, §8.7). Idempotent.
     */
    public void deleteOwn(UUID actorId, UUID commentId) {
        var comment = findOrThrow(commentId);
        // actorId first: a comment left behind by an erased account answers to nobody.
        if (!actorId.equals(comment.authorId())) {
            throw new ForbiddenException("Not the author of comment " + commentId);
        }
        if (comment.isDeleted()) {
            return;
        }
        comment.deletedAt(Instant.now());
        // before the ancestry query: it is native, and the mark decides the walk
        comments.flush();
        collapse(comment);
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

    /**
     * Walks up from a freshly deleted comment, taking away every node that has nothing left under
     * it. Moderation is not involved: a comment it removed keeps its row, and so the parent that
     * row hangs off keeps its own.
     */
    private void collapse(Comment from) {
        var chain = comments.findAncestry(from.path()); // root first, `from` last
        var ids = chain.stream().map(Comment::id).toList();
        var children = comments.countChildrenOf(ids).stream()
                .collect(Collectors.toMap(ChildTally::parentId, ChildTally::children, (a, b) -> a, HashMap::new));
        var reported = reports.findReportedAmong(ids);

        var doomed = new ArrayList<UUID>();
        UUID survivor = null;
        for (var i = chain.size() - 1; i >= 0; i--) {
            var node = chain.get(i);
            if (!collapsible(node, children, reported)) {
                break;
            }
            doomed.add(node.id());
            survivor = node.inReplyToId();
            if (survivor != null) {
                children.merge(survivor, -1L, Long::sum);
            }
        }
        if (doomed.isEmpty()) {
            return;
        }
        comments.deleteByIdIn(doomed);
        // One decrement, not one per node: the parents of everything else in the chain went with it.
        if (survivor != null) {
            comments.decrementReplyCount(survivor);
        }
    }

    private static boolean collapsible(Comment node, Map<UUID, Long> children, Set<UUID> reported) {
        // hiddenAt: the author still sees his removed comment and the counter reads that column.
        // countedAt: same, for a violation counted by hand.
        // reported: the queue card outlives the author deleting his own comment (§10.22).
        return node.isDeleted()
                && !node.isHiddenByModeration()
                && node.countedAt() == null
                && !reported.contains(node.id())
                && children.getOrDefault(node.id(), 0L) == 0L;
    }

    // Helpers

    private void assertMayComment(UUID authorId) {
        var active = restrictions.findActive(authorId, UserRestriction.CAPABILITY_COMMENT, Instant.now());
        if (!active.isEmpty()) {
            // ordered indefinite-first, then latest expiry: the first row is the binding one
            throw new CommentingRestrictedException(active.getFirst().expiresAt());
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
        // No collapse here: the row stays, so everything above it keeps a child and stays too.
        // What the reader should see instead is a render rule, and it comes with B3 (§11.7, §11.12).
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
