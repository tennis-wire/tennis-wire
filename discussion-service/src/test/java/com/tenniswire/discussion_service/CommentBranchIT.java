package com.tenniswire.discussion_service;

import static org.assertj.core.api.Assertions.assertThat;

import com.tenniswire.discussion_service.entity.BlockMode;
import com.tenniswire.discussion_service.service.BlockService;
import com.tenniswire.discussion_service.service.CommentService;
import com.tenniswire.discussion_service.service.CommentView;
import java.util.ArrayList;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/** What a branch hands over, what it marks, and that nothing it withholds is out of reach. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class CommentBranchIT {

    private static final int DEPTH = 5;
    private static final int WIDTH = 20;

    @Autowired
    private CommentService commentService;

    @Autowired
    private BlockService blockService;

    private final UUID subjectId = UUID.randomUUID();
    private final UUID alice = UUID.randomUUID();
    private final UUID bob = UUID.randomUUID();

    @Test
    void aBranchStopsFiveLevelsDownAndTheBottomNodeOpensItsOwn() {
        var root = commentService.create(alice, "publication", subjectId, "0").comment();
        var deepest = root;
        for (var level = 1; level <= 8; level++) {
            deepest =
                    commentService.reply(alice, deepest.id(), "level " + level).comment();
        }

        var branch = commentService.branch(root.id(), null);
        var bottom = descend(branch);

        assertThat(depthOf(branch)).isEqualTo(DEPTH);
        assertThat(bottom.repliesTruncated()).isTrue();
        // and the reader carries on from there rather than stopping
        assertThat(depthOf(commentService.branch(bottom.comment().id(), null))).isEqualTo(3);
    }

    @Test
    void aNodeWithMoreRepliesThanFitIsMarkedAndTheRestAreReadThroughReplies() {
        var root =
                commentService.create(alice, "publication", subjectId, "root").comment();
        for (var i = 0; i < 25; i++) {
            commentService.reply(bob, root.id(), "r" + i);
        }

        var branch = commentService.branch(root.id(), null);
        assertThat(branch.replies()).hasSize(WIDTH);
        assertThat(branch.repliesTruncated()).isTrue();

        var seen = new ArrayList<UUID>();
        String cursor = null;
        do {
            var page = commentService.replies(root.id(), null, WIDTH, cursor);
            page.items().forEach(view -> seen.add(view.comment().id()));
            cursor = page.nextCursor();
        } while (cursor != null);

        assertThat(seen).hasSize(25).doesNotHaveDuplicates();
    }

    @Test
    void repliesCarryOnlyChildrenAndMarkTheOnesWithSubtreesOfTheirOwn() {
        var root =
                commentService.create(alice, "publication", subjectId, "root").comment();
        var child = commentService.reply(bob, root.id(), "child").comment();
        commentService.reply(alice, child.id(), "grandchild");

        var page = commentService.replies(root.id(), null, null, null);

        assertThat(page.items()).hasSize(1);
        assertThat(page.items().getFirst().replies()).isEmpty();
        assertThat(page.items().getFirst().repliesTruncated()).isTrue();
    }

    @Test
    void whatTheViewerRemovedHimselfIsNotMarkedAsWithheld() {
        var root =
                commentService.create(alice, "publication", subjectId, "root").comment();
        commentService.reply(bob, root.id(), "one");
        commentService.reply(bob, root.id(), "two");
        blockService.block(alice, bob, BlockMode.SUBTREE_REMOVAL);

        var branch = commentService.branch(root.id(), alice);

        assertThat(branch.replies()).isEmpty();
        // the service handed both over; they are gone by his own doing, not by ours
        assertThat(branch.repliesTruncated()).isFalse();
    }

    @Test
    void theTopLevelListingMarksEveryCommentThatHasReplies() {
        var withReplies = commentService
                .create(alice, "publication", subjectId, "answered")
                .comment();
        commentService.reply(bob, withReplies.id(), "answer");
        commentService.create(alice, "publication", subjectId, "alone");

        var listed = commentService
                .listTopLevel("publication", subjectId, null, null, null)
                .items();

        assertThat(listed).hasSize(2);
        assertThat(listed.getFirst().repliesTruncated()).isTrue();
        assertThat(listed.getLast().repliesTruncated()).isFalse();
    }

    private static CommentView descend(CommentView from) {
        var node = from;
        while (!node.replies().isEmpty()) {
            node = node.replies().getFirst();
        }
        return node;
    }

    /** Levels below the head: 0 when the head carries no replies at all. */
    private static int depthOf(CommentView from) {
        var levels = 0;
        for (var node = from; !node.replies().isEmpty(); node = node.replies().getFirst()) {
            levels++;
        }
        return levels;
    }
}
