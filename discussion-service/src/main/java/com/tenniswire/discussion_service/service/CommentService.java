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
import com.tenniswire.discussion_service.exception.ParentDeletedException;
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

    private static final int DEFAULT_LIMIT = 50;

    // A ceiling rather than a rejection: the parameter arrives from outside, and without one a
    // single request can ask the service to assemble the whole thread and every author's name.
    private static final int MAX_LIMIT = 200;
    private static final int MIN_LIMIT = 1;

    private final CommentRepository comments;
    private final CommentCollapse collapse;
    private final BlockRepository blocks;
    private final UserRestrictionRepository restrictions;
    private final ReportRepository reports;
    private final DomainEventPublisher events;
    private final SubjectTypes subjects;

    public CommentService(
            CommentRepository comments,
            CommentCollapse collapse,
            BlockRepository blocks,
            UserRestrictionRepository restrictions,
            ReportRepository reports,
            DomainEventPublisher events,
            SubjectTypes subjects) {
        this.comments = comments;
        this.collapse = collapse;
        this.blocks = blocks;
        this.restrictions = restrictions;
        this.reports = reports;
        this.events = events;
        this.subjects = subjects;
    }

    public CreatedComment create(UUID authorId, String subjectType, UUID subjectId, String body) {
        // Only here and on the listing: a reply takes its subject from the parent, so a kind
        // dropped from the list stops taking new threads without cutting the ones already standing.
        subjects.assertKnown(subjectType);
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
        var parent = findOrThrow(parentId);
        // A gravestone is kept to hold up what is already under it, not to gather more. It has no
        // reply button (discussion-rules §5.2), so this is someone whose form was open while the
        // comment came down — and letting it through would keep alive a node that was about to
        // collapse under §8.7.
        if (parent.isDeleted()) {
            throw new ParentDeletedException(parentId);
        }

        var comment = new Comment()
                .subjectType(parent.subjectType())
                .subjectId(parent.subjectId())
                .inReplyToId(parent.id())
                .authorId(authorId)
                .body(body);
        var saved = comments.saveAndFlush(comment);
        comments.incrementReplyCount(parent.id());

        // A standing comment always has its author, so there is always someone who may have
        // blocked him: the constraint sees to it that only a comment already down can be authorless.
        var muted = blocks.existsById(new BlockId(parent.authorId(), authorId));
        events.publish(toEvent(saved));
        return new CreatedComment(saved, muted);
    }

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
        // before the collapse reads it back: the mark is what decides the walk
        comments.flush();
        collapse.of(List.of(comment));
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

    // One page of top-level comments, oldest first. A limit outside the allowed range is brought
    // into it rather than refused: a limit is a request for how much, not a claim about the world,
    // and no client is served by a 400 where 200 rows would do.
    @Transactional(readOnly = true)
    public CommentPage listTopLevel(
            String subjectType,
            UUID subjectId,
            @Nullable UUID viewerId,
            @Nullable Integer limit,
            @Nullable String cursor) {
        // On the read path too: an unknown type matches nothing, and an empty list is what a page
        // with no comments yet looks like. A misspelt client would look like a quiet article.
        subjects.assertKnown(subjectType);
        var size = limit == null ? DEFAULT_LIMIT : Math.clamp(limit, MIN_LIMIT, MAX_LIMIT);
        var after = CommentCursor.decode(cursor);

        var rows = after == null
                ? comments.findTopLevelFirstPage(subjectType, subjectId, size + 1)
                : comments.findTopLevelAfter(subjectType, subjectId, after.createdAt(), after.id(), size + 1);
        var more = rows.size() > size;
        var page = more ? rows.subList(0, size) : rows;

        // Taken from the last row of the page, not from the last one this viewer will see: blocks
        // are applied below, and a page he has removed in full would otherwise end the listing for
        // him while comments are still waiting behind it.
        var nextCursor = more ? CommentCursor.encode(page.getLast()) : null;
        return new CommentPage(BlockRenderPolicy.apply(CommentTree.forest(page), blocksOf(viewerId)), nextCursor);
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
