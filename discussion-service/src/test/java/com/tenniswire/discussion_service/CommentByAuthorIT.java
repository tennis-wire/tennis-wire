package com.tenniswire.discussion_service;

import static org.assertj.core.api.Assertions.assertThat;

import com.tenniswire.discussion_service.entity.BlockMode;
import com.tenniswire.discussion_service.service.BlockService;
import com.tenniswire.discussion_service.service.CommentService;
import com.tenniswire.discussion_service.service.CommentView;
import com.tenniswire.discussion_service.service.Visibility;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class CommentByAuthorIT {

    private static final int PAGE = 10;

    @Autowired
    private CommentService commentService;

    @Autowired
    private BlockService blockService;

    private final UUID subjectId = UUID.randomUUID();
    private final UUID alice = UUID.randomUUID();
    private final UUID bob = UUID.randomUUID();
    private final UUID moderator = UUID.randomUUID();

    @Test
    void pagesWalkEverythingTheAuthorWroteNewestFirst() {
        var written = new ArrayList<UUID>();
        for (var i = 0; i < 25; i++) {
            written.add(commentService
                    .create(alice, "publication", subjectId, "c" + i)
                    .comment()
                    .id());
        }
        commentService.create(bob, "publication", subjectId, "not hers");

        var seen = new ArrayList<UUID>();
        String cursor = null;
        var pages = 0;
        do {
            var page = commentService.listByAuthor(alice, null, PAGE, cursor);
            page.items().forEach(view -> seen.add(view.comment().id()));
            cursor = page.nextCursor();
            pages++;
        } while (cursor != null && pages < 10);

        assertThat(pages).isEqualTo(3);
        assertThat(seen).hasSize(25).doesNotHaveDuplicates();
        assertThat(seen).containsExactlyElementsOf(written.reversed());
        assertThat(commentService.countByAuthor(alice)).isEqualTo(25);
    }

    @Test
    void whatIsDownIsOutOfTheListingAndOutOfTheCount() {
        var standing = commentService
                .create(alice, "publication", subjectId, "standing")
                .comment()
                .id();
        var ownDeletion = commentService
                .create(alice, "publication", subjectId, "deleted by her")
                .comment()
                .id();
        var takenDown = commentService
                .create(alice, "publication", subjectId, "removed by moderation")
                .comment()
                .id();
        // a reply keeps the two placeholders standing in the thread; the profile still leaves them out
        commentService.reply(bob, ownDeletion, "reply");
        commentService.reply(bob, takenDown, "reply");
        commentService.deleteOwn(alice, ownDeletion);
        commentService.hideByModerator(takenDown, moderator);

        var page = commentService.listByAuthor(alice, alice, PAGE, null);

        assertThat(ids(page.items())).containsExactly(standing);
        assertThat(commentService.countByAuthor(alice)).isEqualTo(1);
    }

    @Test
    void aReplyStandsOnItsOwnLineBesideTheCommentItAnswers() {
        var parent = commentService
                .create(alice, "publication", subjectId, "parent")
                .comment()
                .id();
        var reply =
                commentService.reply(alice, parent, "her own reply").comment().id();

        var page = commentService.listByAuthor(alice, null, PAGE, null);

        assertThat(ids(page.items())).containsExactly(reply, parent);
        assertThat(page.items()).allSatisfy(view -> assertThat(view.replies()).isEmpty());
        var head = page.items().getLast();
        assertThat(head.replyCount()).isEqualTo(1);
        assertThat(head.repliesTruncated()).isTrue();
    }

    @Test
    void theViewerIgnoreShapesTheProfileAsItShapesAThread() {
        commentService.create(alice, "publication", subjectId, "hers");
        blockService.block(bob, alice, BlockMode.SOFT);

        var softened = commentService.listByAuthor(alice, bob, PAGE, null);
        assertThat(softened.items()).singleElement().satisfies(view -> assertThat(view.visibility())
                .isEqualTo(Visibility.SOFT_HIDDEN));

        blockService.block(bob, alice, BlockMode.SUBTREE_REMOVAL);
        var removed = commentService.listByAuthor(alice, bob, PAGE, null);
        assertThat(removed.items()).isEmpty();
        // the number under the name is what she wrote, not what this viewer is shown
        assertThat(commentService.countByAuthor(alice)).isEqualTo(1);
    }

    private static List<UUID> ids(List<CommentView> views) {
        return views.stream().map(view -> view.comment().id()).toList();
    }
}
