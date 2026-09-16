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
import com.tenniswire.discussion_service.exception.HiddenByBlockException;
import com.tenniswire.discussion_service.exception.ParentDeletedException;
import com.tenniswire.discussion_service.exception.ResolutionNotApplicableException;
import com.tenniswire.discussion_service.exception.ResourceNotFoundException;
import com.tenniswire.discussion_service.repository.BlockRepository;
import com.tenniswire.discussion_service.repository.ChildTally;
import com.tenniswire.discussion_service.repository.CommentRepository;
import com.tenniswire.discussion_service.repository.ReportRepository;
import com.tenniswire.discussion_service.repository.UserRestrictionRepository;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class CommentService {

    /** What the listing hands out when the caller names no size of its own. */
    private static final int DEFAULT_LIMIT = 50;

    // A ceiling rather than a rejection: the parameter arrives from outside, and without one a
    // single request can ask the service to assemble the whole thread and every author's name.
    private static final int MAX_LIMIT = 200;
    private static final int MIN_LIMIT = 1;

    // How much of a subtree one branch response carries. Both are the size of a first helping, not
    // a ceiling on what can be read: past either edge the reader goes on through /replies or
    // through a branch of the node he stopped at.
    private static final int BRANCH_DEPTH = 5;
    private static final int BRANCH_WIDTH = 20;

    // The ceiling on rows read for one branch, whatever shape the thread took. Spent nearest the
    // head first, so what it cuts is the far end of a very wide level, and that comes back through
    // the marks on the nodes above it.
    private static final int BRANCH_BUDGET = 500;

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
        // reply button, so this is someone whose form was open while the comment came down - and
        // letting it through would keep alive a node that was about to collapse.
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
        collapse.of(List.of(comment), Set.of(comment.id()));
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
        return new CommentPage(render(CommentTree.forest(page), blocksOf(viewerId)), nextCursor);
    }

    // The comment with as much of its subtree as one response carries. NOT_FOUND when nobody is
    // shown the head, HIDDEN_BY_BLOCK when the viewer's subtree_removal takes out the head or a
    // comment above it. Nodes whose replies did not fit come back marked.
    @Transactional(readOnly = true)
    public CommentView branch(UUID commentId, @Nullable UUID viewerId) {
        var head = findOrThrow(commentId);
        var rows = comments.findSubtreeToDepth(head.path(), BRANCH_DEPTH, BRANCH_BUDGET);
        var tree = CommentTree.forest(rows, BRANCH_WIDTH);
        // Empty when the head is a placeholder nobody is shown: the row is there, the comment is
        // not. The query returns head plus descendants, so otherwise there is exactly one root.
        if (tree.isEmpty()) {
            throw new ResourceNotFoundException("Comment", commentId);
        }
        var blocks = blocksOf(viewerId);
        assertNotRemovedFromAbove(head, blocks);
        // Empty for a placeholder head whose every reply this viewer removes
        return render(tree.getFirst(), blocks).orElseThrow(() -> new ResourceNotFoundException("Comment", commentId));
    }

    // Direct replies of one comment, a page at a time. Where a branch stops, this carries on: every
    // reply is reachable, however many a comment gathered.
    @Transactional(readOnly = true)
    public CommentPage replies(
            UUID parentId, @Nullable UUID viewerId, @Nullable Integer limit, @Nullable String cursor) {
        var parent = findOrThrow(parentId);
        // Gone from view: there is no comment here to read the replies of, exactly as in a branch
        if (CommentTree.forest(List.of(parent)).isEmpty()) {
            throw new ResourceNotFoundException("Comment", parentId);
        }
        var blocks = blocksOf(viewerId);
        assertNotRemovedFromAbove(parent, blocks);

        var size = limit == null ? DEFAULT_LIMIT : Math.clamp(limit, MIN_LIMIT, MAX_LIMIT);
        var after = CommentCursor.decode(cursor);
        var rows = after == null
                ? comments.findRepliesFirstPage(parentId, size + 1)
                : comments.findRepliesAfter(parentId, after.createdAt(), after.id(), size + 1);
        var more = rows.size() > size;
        var page = more ? rows.subList(0, size) : rows;

        var nextCursor = more ? CommentCursor.encode(page.getLast()) : null;
        return new CommentPage(render(CommentTree.forest(page), blocks), nextCursor);
    }

    /**
     * Root first, the requested comment last, no replies attached. A placeholder nobody is shown
     * anywhere on the way cuts the chain: NOT_FOUND. A subtree_removal block on the comment or any
     * ancestor hides it from that viewer alone: HIDDEN_BY_BLOCK.
     */
    @Transactional(readOnly = true)
    public List<CommentView> ancestry(UUID commentId, @Nullable UUID viewerId) {
        var target = findOrThrow(commentId);
        var rows = comments.findAncestry(target.path());
        var chain = CommentTree.forest(rows);
        // Empty when the thread root itself is a placeholder nobody is shown, which is the whole
        // chain gone. Otherwise the ancestry is one linear tree rooted at that root.
        if (chain.isEmpty() || !reaches(chain.getFirst(), commentId)) {
            throw new ResourceNotFoundException("Comment", commentId);
        }
        var blocks = blocksOf(viewerId);
        assertNotRemoved(commentId, rows, removedBy(blocks));

        var flat = new ArrayList<CommentView>();
        var cursor = render(chain.getFirst(), blocks).orElse(null);
        while (cursor != null) {
            // The chain carries no replies at all, so any comment that has one is truncated here
            flat.add(new CommentView(
                    cursor.comment(), cursor.visibility(), cursor.replyCount(), cursor.replyCount() > 0, List.of()));
            cursor = cursor.replies().isEmpty() ? null : cursor.replies().getFirst();
        }
        // Everything above holds on to the next comment of the chain, so only the comment itself can
        // drop out here: a placeholder whose every reply this viewer removes
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
        // However the comment came down, the queue is done with it - including when it was taken
        // down straight from the comment endpoint, with no card ever opened.
        reports.closeOpen(comment.id(), ReportResolution.HIDDEN, moderatorId);
        // The row stays, pinned by the very column that records the removal, but the reader stops
        // being shown it once nothing is left underneath. The collapse is what carries that
        // upward: the counts come down, and a placeholder above that held nothing else goes with it.
        comments.flush();
        collapse.of(List.of(comment), Set.of(comment.id()));
    }

    // For a comment loaded without its chain. The chain is read only if the viewer has a
    // subtree_removal at all.
    private void assertNotRemovedFromAbove(Comment comment, Map<UUID, BlockMode> blocks) {
        var removed = removedBy(blocks);
        if (!removed.isEmpty()) {
            assertNotRemoved(comment.id(), comments.findAncestry(comment.path()), removed);
        }
    }

    // One rule for ancestry, branch and replies: the comment is gone for a viewer who removes, with
    // its branch, a comment of the chain. blockedIds name the authors of signed comments only: a
    // placeholder does not give its author away, to the blocker either.
    private static void assertNotRemoved(UUID commentId, List<Comment> chain, Set<UUID> removed) {
        if (chain.stream().noneMatch(comment -> removed.contains(comment.authorId()))) {
            return;
        }
        // The chain comes ordered by depth, so the authors do too: nearest the root first
        var blockedIds = chain.stream()
                .filter(comment -> !comment.isDeleted())
                .map(Comment::authorId)
                .filter(removed::contains)
                .distinct()
                .toList();
        throw new HiddenByBlockException(commentId, blockedIds);
    }

    private List<CommentView> render(List<CommentNode> nodes, Map<UUID, BlockMode> blocks) {
        return BlockRenderPolicy.apply(nodes, blocks, removedReplies(nodes, blocks));
    }

    private Optional<CommentView> render(CommentNode node, Map<UUID, BlockMode> blocks) {
        return BlockRenderPolicy.apply(node, blocks, removedReplies(List.of(node), blocks));
    }

    // Per loaded comment, how many of its counted replies the viewer removes with their branches.
    // One query for the whole tree, and none for a viewer who removes nobody.
    private Map<UUID, Integer> removedReplies(List<CommentNode> nodes, Map<UUID, BlockMode> blocks) {
        var removed = removedBy(blocks);
        if (removed.isEmpty() || nodes.isEmpty()) {
            return Map.of();
        }
        var ids = new ArrayList<UUID>();
        var pending = new ArrayDeque<>(nodes);
        while (!pending.isEmpty()) {
            var node = pending.pop();
            ids.add(node.comment().id());
            pending.addAll(node.children());
        }
        return comments.countChildrenByAuthorsAmong(ids, removed).stream()
                .collect(Collectors.toMap(
                        ChildTally::parentId, tally -> tally.shown().intValue()));
    }

    // Authors whose comments the viewer takes out together with everything under them. A HashSet:
    // an erased author is null, and an immutable set would throw on the lookup.
    private static Set<UUID> removedBy(Map<UUID, BlockMode> blocks) {
        return blocks.entrySet().stream()
                .filter(block -> block.getValue() == BlockMode.SUBTREE_REMOVAL)
                .map(Map.Entry::getKey)
                .collect(Collectors.toCollection(HashSet::new));
    }

    // A placeholder nobody is shown is pruned from the tree and cuts the chain below it
    private static boolean reaches(CommentNode root, UUID commentId) {
        var node = root;
        while (!node.children().isEmpty()) {
            node = node.children().getFirst();
        }
        return node.comment().id().equals(commentId);
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
