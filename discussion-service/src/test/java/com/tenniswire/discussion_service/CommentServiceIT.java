package com.tenniswire.discussion_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.tenniswire.discussion_service.entity.BlockMode;
import com.tenniswire.discussion_service.exception.CommentingRestrictedException;
import com.tenniswire.discussion_service.exception.ForbiddenException;
import com.tenniswire.discussion_service.exception.ResourceNotFoundException;
import com.tenniswire.discussion_service.repository.CommentRepository;
import com.tenniswire.discussion_service.service.BlockService;
import com.tenniswire.discussion_service.service.CommentService;
import com.tenniswire.discussion_service.service.RestrictionService;
import com.tenniswire.discussion_service.service.Visibility;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * Against a real PostgreSQL: the ltree trigger, INSERT ... RETURNING into the @Generated columns,
 * the reply_count update and the restriction gate are all things a mock would only pretend about.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class CommentServiceIT {

    @Autowired
    private CommentService commentService;

    @Autowired
    private BlockService blockService;

    @Autowired
    private RestrictionService restrictionService;

    @Autowired
    private CommentRepository commentRepository;

    private final UUID subjectId = UUID.randomUUID();
    private final UUID alice = UUID.randomUUID();
    private final UUID bob = UUID.randomUUID();
    private final UUID moderator = UUID.randomUUID();

    @Test
    void pathAndRootAreDerivedDownTheTree() {
        var root = commentService.create(alice, "article", subjectId, "root").comment();
        var reply = commentService.reply(bob, root.id(), "reply").comment();
        var nested = commentService.reply(alice, reply.id(), "nested").comment();

        assertThat(root.path()).isNotNull();
        assertThat(root.rootId()).isEqualTo(root.id());
        assertThat(reply.path()).isEqualTo(root.path() + "." + reply.pathKey());
        assertThat(nested.path()).isEqualTo(reply.path() + "." + nested.pathKey());
        assertThat(nested.rootId()).isEqualTo(root.id());
        assertThat(nested.subjectId()).isEqualTo(subjectId);
        assertThat(nested.createdAt()).isNotNull();
    }

    @Test
    void replyCountIsMaintainedOnTheDirectParentOnly() {
        var root = commentService.create(alice, "article", subjectId, "root").comment();
        var reply = commentService.reply(bob, root.id(), "reply").comment();
        commentService.reply(alice, reply.id(), "nested");
        commentService.reply(alice, reply.id(), "nested again");

        assertThat(commentRepository.findById(root.id()).orElseThrow().replyCount())
                .isEqualTo(1);
        assertThat(commentRepository.findById(reply.id()).orElseThrow().replyCount())
                .isEqualTo(2);
    }

    @Test
    void branchAndAncestryComeBackViaLtree() {
        var root = commentService.create(alice, "article", subjectId, "root").comment();
        var reply = commentService.reply(bob, root.id(), "reply").comment();
        var nested = commentService.reply(alice, reply.id(), "nested").comment();
        commentService.reply(bob, root.id(), "sibling");

        var branch = commentService.branch(reply.id(), null);
        assertThat(branch.comment().id()).isEqualTo(reply.id());
        assertThat(branch.replies()).extracting(v -> v.comment().id()).containsExactly(nested.id());

        var chain = commentService.ancestry(nested.id(), null);
        assertThat(chain).extracting(v -> v.comment().id()).containsExactly(root.id(), reply.id(), nested.id());
    }

    @Test
    void softDeleteKeepsTheChildrenAndWithholdsTheBody() {
        var root = commentService.create(alice, "article", subjectId, "root").comment();
        var reply = commentService.reply(bob, root.id(), "reply").comment();
        var nested = commentService.reply(alice, reply.id(), "nested").comment();

        commentService.deleteOwn(bob, reply.id());

        var branch = commentService.branch(root.id(), null);
        var deleted = branch.replies().getFirst();
        assertThat(deleted.visibility()).isEqualTo(Visibility.DELETED);
        assertThat(deleted.replies()).extracting(v -> v.comment().id()).containsExactly(nested.id());
        // still accepts replies: the node is kept for exactly that
        assertThat(commentService
                        .reply(alice, reply.id(), "after delete")
                        .comment()
                        .inReplyToId())
                .isEqualTo(reply.id());
    }

    @Test
    void onlyTheAuthorMayDeleteAndTheModeratorPathHasNoOwnerCheck() {
        var root = commentService.create(alice, "article", subjectId, "root").comment();

        assertThatThrownBy(() -> commentService.deleteOwn(bob, root.id())).isInstanceOf(ForbiddenException.class);
        commentService.hide(root.id());
        assertThat(commentRepository.findById(root.id()).orElseThrow().isDeleted())
                .isTrue();
    }

    @Test
    void activeRestrictionRejectsTheWriteBeforeInsert() {
        restrictionService.restrictCommenting(bob, moderator, Instant.now().plus(Duration.ofHours(1)), "flood");

        assertThatThrownBy(() -> commentService.create(bob, "article", subjectId, "nope"))
                .isInstanceOf(CommentingRestrictedException.class)
                .satisfies(e -> assertThat(((CommentingRestrictedException) e).restrictedUntil())
                        .isNotNull());
        assertThat(commentRepository.findBySubjectTypeAndSubjectIdAndInReplyToIdIsNullOrderByCreatedAtAscIdAsc(
                        "article", subjectId))
                .isEmpty();
    }

    @Test
    void liftedRestrictionNoLongerGates() {
        var lifted = restrictionService.restrictCommenting(bob, moderator, null, "indefinite");
        restrictionService.lift(lifted.id());

        assertThat(commentService
                        .create(bob, "article", subjectId, "ok")
                        .comment()
                        .id())
                .isNotNull();
        assertThatThrownBy(() -> restrictionService.lift(lifted.id())).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void mutedFlagIsSetWhenTheParentAuthorBlockedTheReplier() {
        blockService.block(alice, bob, BlockMode.GRAVESTONE);
        var root = commentService.create(alice, "article", subjectId, "root").comment();

        var bobReply = commentService.reply(bob, root.id(), "still stored");
        assertThat(bobReply.mutedByRecipient()).isTrue();
        // the reply went through and everyone else sees it
        assertThat(commentService.branch(root.id(), null).replies()).hasSize(1);
        // alice, the blocker, gets the gravestone
        assertThat(commentService.branch(root.id(), alice).replies().getFirst().visibility())
                .isEqualTo(Visibility.GRAVESTONE);
        // bob's own reply to alice is not "muted": the block is one-directional
        assertThat(commentService.reply(alice, bobReply.comment().id(), "back").mutedByRecipient())
                .isFalse();
    }

    @Test
    void subtreeRemovalHidesTheBranchAndTheAncestryForTheBlockerOnly() {
        var root = commentService.create(alice, "article", subjectId, "root").comment();
        var bobReply = commentService.reply(bob, root.id(), "reply").comment();
        var nested = commentService.reply(alice, bobReply.id(), "nested").comment();
        blockService.block(alice, bob, BlockMode.SUBTREE_REMOVAL);

        assertThat(commentService.listTopLevel("article", subjectId, alice)).hasSize(1);
        assertThat(commentService.branch(root.id(), alice).replies()).isEmpty();
        assertThatThrownBy(() -> commentService.branch(bobReply.id(), alice))
                .isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> commentService.ancestry(nested.id(), alice))
                .isInstanceOf(ResourceNotFoundException.class);
        assertThat(commentService.ancestry(nested.id(), bob)).hasSize(3);
    }

    @Test
    void selfBlockIsRejectedAndReblockChangesTheMode() {
        assertThatThrownBy(() -> blockService.block(alice, alice, BlockMode.SOFT))
                .isInstanceOf(IllegalArgumentException.class);

        blockService.block(alice, bob, BlockMode.SOFT);
        blockService.block(alice, bob, BlockMode.GRAVESTONE);

        assertThat(blockService.list(alice)).hasSize(1);
        assertThat(blockService.list(alice).getFirst().mode()).isEqualTo(BlockMode.GRAVESTONE);
        blockService.unblock(alice, bob);
        blockService.unblock(alice, bob);
        assertThat(blockService.list(alice)).isEmpty();
    }
}
