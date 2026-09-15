package com.tenniswire.discussion_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.tenniswire.discussion_service.exception.ResourceNotFoundException;
import com.tenniswire.discussion_service.repository.CommentRepository;
import com.tenniswire.discussion_service.service.CommentService;
import com.tenniswire.discussion_service.service.ReportService;
import com.tenniswire.discussion_service.service.Visibility;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class RemovedCommentVisibilityIT {

    @Autowired
    private CommentService commentService;

    @Autowired
    private ReportService reportService;

    @Autowired
    private CommentRepository commentRepository;

    private final UUID subjectId = UUID.randomUUID();
    private final UUID alice = UUID.randomUUID();
    private final UUID bob = UUID.randomUUID();
    private final UUID moderator = UUID.randomUUID();

    @Test
    void aRemovalWithNothingUnderItKeepsItsRowAndLeavesThePage() {
        var comment = commentService
                .create(alice, "publication", subjectId, "removed")
                .comment();

        commentService.hideByModerator(comment.id(), moderator);

        assertThat(commentRepository.findById(comment.id())).isPresent();
        assertThat(commentService
                        .listTopLevel("publication", subjectId, null, null, null)
                        .items())
                .isEmpty();
    }

    @Test
    void aRemovalWithRepliesStaysOnThePageAsAPlaceholder() {
        var comment = commentService
                .create(alice, "publication", subjectId, "removed")
                .comment();
        commentService.reply(bob, comment.id(), "reply");

        commentService.hideByModerator(comment.id(), moderator);

        var listed = commentService
                .listTopLevel("publication", subjectId, null, null, null)
                .items();
        assertThat(listed).hasSize(1);
        // and says who took it down, which a deletion by the author does not
        assertThat(listed.getFirst().visibility()).isEqualTo(Visibility.REMOVED);
    }

    @Test
    void aBotRemovalReadsTheSameAsAModeratorOne() {
        var comment = commentService
                .create(alice, "publication", subjectId, "removed")
                .comment();
        commentService.reply(bob, comment.id(), "reply");

        commentService.hideByBot(comment.id());

        var listed = commentService
                .listTopLevel("publication", subjectId, null, null, null)
                .items();
        assertThat(listed.getFirst().visibility()).isEqualTo(Visibility.REMOVED);
    }

    @Test
    void anErasedAuthorLeavesTheRemovalMarkAlone() {
        var comment = commentService
                .create(alice, "publication", subjectId, "removed")
                .comment();
        commentService.reply(bob, comment.id(), "reply");
        commentService.hideByModerator(comment.id(), moderator);

        commentRepository.anonymize(List.of(comment.id()));

        var listed = commentService
                .listTopLevel("publication", subjectId, null, null, null)
                .items();
        assertThat(listed.getFirst().visibility()).isEqualTo(Visibility.REMOVED);
    }

    @Test
    void aChainOfRemovalsGoesAllTheWayUpWithoutWalkingTheTree() {
        var root =
                commentService.create(alice, "publication", subjectId, "root").comment();
        var a = commentService.reply(alice, root.id(), "A").comment();
        var b = commentService.reply(bob, a.id(), "B").comment();

        commentService.hideByModerator(a.id(), moderator);
        commentService.hideByModerator(b.id(), moderator);

        // both rows are evidence and both stay
        assertThat(commentRepository.findById(a.id())).isPresent();
        assertThat(commentRepository.findById(b.id())).isPresent();
        // B emptied A, which emptied the root: the count is what carried it up
        assertThat(commentRepository.findById(root.id()).orElseThrow().replyCount())
                .isZero();

        var listed = commentService
                .listTopLevel("publication", subjectId, null, null, null)
                .items();
        assertThat(listed).hasSize(1);
        assertThat(listed.getFirst().replies()).isEmpty();
        assertThat(listed.getFirst().repliesTruncated()).isFalse();
    }

    @Test
    void aPinnedRowIsNotDeletedWhileSomethingStillPointsAtIt() {
        var a = commentService.create(alice, "publication", subjectId, "A").comment();
        var b = commentService.reply(bob, a.id(), "B").comment();
        var c = commentService.reply(alice, b.id(), "C").comment();

        commentService.deleteOwn(bob, b.id());
        commentService.hideByModerator(c.id(), moderator);

        // C is pinned by its own removal, and B cannot go while C points at it
        assertThat(commentRepository.findById(c.id())).isPresent();
        assertThat(commentRepository.findById(b.id())).isPresent();
        // but neither is shown any more, so A carries nothing
        assertThat(commentRepository.findById(a.id()).orElseThrow().replyCount())
                .isZero();
    }

    @Test
    void anAuthorDeletionPinnedByAReportAlsoLeavesThePage() {
        var comment = commentService
                .create(alice, "publication", subjectId, "reported")
                .comment();
        reportService.report(bob, comment.id(), "spam");

        commentService.deleteOwn(alice, comment.id());

        // the queue card outlives the deletion, so the row is held back
        assertThat(commentRepository.findById(comment.id())).isPresent();
        assertThat(commentService
                        .listTopLevel("publication", subjectId, null, null, null)
                        .items())
                .isEmpty();
    }

    @Test
    void whatNobodyIsShownIsNotReachableByItsOwnAddressEither() {
        var comment = commentService
                .create(alice, "publication", subjectId, "removed")
                .comment();
        commentService.hideByModerator(comment.id(), moderator);

        assertThatThrownBy(() -> commentService.branch(comment.id(), null))
                .isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> commentService.replies(comment.id(), null, null, null))
                .isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> commentService.ancestry(comment.id(), null))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
