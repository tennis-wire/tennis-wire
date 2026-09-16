package com.tenniswire.discussion_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.tenniswire.discussion_service.entity.BlockMode;
import com.tenniswire.discussion_service.exception.ResourceNotFoundException;
import com.tenniswire.discussion_service.service.BlockService;
import com.tenniswire.discussion_service.service.CommentService;
import com.tenniswire.discussion_service.service.CommentView;
import com.tenniswire.discussion_service.service.Visibility;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

// Replies as counted for a viewer who removes bob with his branches, next to everyone else's count
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ViewerReplyCountIT {

    private static final int WIDTH = 20;

    @Autowired
    private CommentService commentService;

    @Autowired
    private BlockService blockService;

    private final UUID subjectId = UUID.randomUUID();
    private final UUID alice = UUID.randomUUID();
    private final UUID bob = UUID.randomUUID();
    private final UUID carol = UUID.randomUUID();
    private final UUID viewer = UUID.randomUUID();

    @BeforeEach
    void viewerRemovesBob() {
        blockService.block(viewer, bob, BlockMode.SUBTREE_REMOVAL);
    }

    @Test
    void theCountLeavesOutWhatTheViewerRemoves() {
        var root =
                commentService.create(alice, "publication", subjectId, "root").comment();
        commentService.reply(bob, root.id(), "bob");
        commentService.reply(carol, root.id(), "carol");

        assertThat(listed(viewer).replyCount()).isEqualTo(1);
        assertThat(listed(null).replyCount()).isEqualTo(2);

        var branch = commentService.branch(root.id(), viewer);
        assertThat(branch.replyCount()).isEqualTo(1);
        assertThat(branch.replies()).hasSize(1);
        assertThat(branch.repliesTruncated()).isFalse();
    }

    @Test
    void withEveryReplyRemovedThereIsNothingToOpen() {
        var root =
                commentService.create(alice, "publication", subjectId, "root").comment();
        commentService.reply(bob, root.id(), "bob");

        assertThat(listed(viewer).replyCount()).isZero();
        assertThat(listed(viewer).repliesTruncated()).isFalse();
    }

    @Test
    void aPlaceholderWithOnlyRemovedRepliesIsNotThereForTheViewer() {
        var root =
                commentService.create(alice, "publication", subjectId, "root").comment();
        commentService.reply(bob, root.id(), "bob");
        commentService.deleteOwn(alice, root.id());

        assertThat(listed(null).visibility()).isEqualTo(Visibility.DELETED);
        assertThat(commentService
                        .listTopLevel("publication", subjectId, viewer, null, null)
                        .items())
                .isEmpty();
        assertThatThrownBy(() -> commentService.branch(root.id(), viewer))
                .isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> commentService.ancestry(root.id(), viewer))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void aBranchIsNotMarkedWhenEverythingItHeldBackIsRemoved() {
        var root =
                commentService.create(alice, "publication", subjectId, "root").comment();
        for (var i = 0; i < WIDTH; i++) {
            commentService.reply(carol, root.id(), "carol " + i);
        }
        // the newest, one past what a branch carries
        commentService.reply(bob, root.id(), "bob");

        var forViewer = commentService.branch(root.id(), viewer);
        assertThat(forViewer.replyCount()).isEqualTo(WIDTH);
        assertThat(forViewer.replies()).hasSize(WIDTH);
        assertThat(forViewer.repliesTruncated()).isFalse();

        var forEveryoneElse = commentService.branch(root.id(), null);
        assertThat(forEveryoneElse.replyCount()).isEqualTo(WIDTH + 1);
        assertThat(forEveryoneElse.repliesTruncated()).isTrue();
    }

    @Test
    void anAncestryCountsTheSameWay() {
        var root =
                commentService.create(alice, "publication", subjectId, "root").comment();
        var reply = commentService.reply(carol, root.id(), "carol").comment();
        commentService.reply(bob, root.id(), "bob");

        assertThat(commentService.ancestry(reply.id(), viewer).getFirst().replyCount())
                .isEqualTo(1);
    }

    private CommentView listed(UUID viewerId) {
        return commentService
                .listTopLevel("publication", subjectId, viewerId, null, null)
                .items()
                .getFirst();
    }
}
