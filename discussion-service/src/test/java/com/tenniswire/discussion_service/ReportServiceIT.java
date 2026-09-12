package com.tenniswire.discussion_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.tenniswire.discussion_service.entity.BlockMode;
import com.tenniswire.discussion_service.entity.Comment;
import com.tenniswire.discussion_service.exception.CommentAlreadyRemovedException;
import com.tenniswire.discussion_service.exception.ForbiddenException;
import com.tenniswire.discussion_service.exception.ResourceNotFoundException;
import com.tenniswire.discussion_service.repository.CommentRepository;
import com.tenniswire.discussion_service.repository.ReportRepository;
import com.tenniswire.discussion_service.service.BlockService;
import com.tenniswire.discussion_service.service.CommentService;
import com.tenniswire.discussion_service.service.ReportService;
import com.tenniswire.discussion_service.service.RestrictionService;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ReportServiceIT {

    @Autowired
    private ReportService reportService;

    @Autowired
    private CommentService commentService;

    @Autowired
    private BlockService blockService;

    @Autowired
    private RestrictionService restrictionService;

    @Autowired
    private CommentRepository comments;

    @Autowired
    private ReportRepository reports;

    private final UUID subjectId = UUID.randomUUID();
    private final UUID alice = UUID.randomUUID();
    private final UUID bob = UUID.randomUUID();
    private final UUID carol = UUID.randomUUID();

    @Test
    void aReaderIsCountedOnceHoweverOftenHeFiles() {
        var comment = commentOf(alice);

        reportService.report(bob, comment, "spam");
        reportService.report(bob, comment, "insult");
        reportService.report(carol, comment, "spam");

        assertThat(openReportsOn(comment)).isEqualTo(2);
    }

    @Test
    void theAuthorCannotReportHimself() {
        var comment = commentOf(alice);

        assertThatThrownBy(() -> reportService.report(alice, comment, "spam")).isInstanceOf(ForbiddenException.class);
    }

    @Test
    void aCommentItsAuthorDeletedIsStillReportable() {
        var comment = commentOf(alice);
        commentService.deleteOwn(alice, comment);

        reportService.report(bob, comment, "spam");

        assertThat(openReportsOn(comment)).isEqualTo(1);
    }

    @Test
    void aCommentModerationRemovedIsNot() {
        var comment = commentOf(alice);
        removeByModeration(comment);

        assertThatThrownBy(() -> reportService.report(bob, comment, "spam"))
                .isInstanceOf(CommentAlreadyRemovedException.class);
    }

    @Test
    void anIgnoredAuthorIsReportableOnlyWhileHisCommentIsStillReachable() {
        var comment = commentOf(alice);

        blockService.block(bob, alice, BlockMode.SOFT);
        reportService.report(bob, comment, "spam");
        assertThat(openReportsOn(comment)).isEqualTo(1);

        blockService.block(carol, alice, BlockMode.GRAVESTONE);
        assertThatThrownBy(() -> reportService.report(carol, comment, "spam")).isInstanceOf(ForbiddenException.class);

        var dave = UUID.randomUUID();
        blockService.block(dave, alice, BlockMode.SUBTREE_REMOVAL);
        assertThatThrownBy(() -> reportService.report(dave, comment, "spam")).isInstanceOf(ForbiddenException.class);
    }

    @Test
    void aReaderServingABanMayStillReport() {
        var comment = commentOf(alice);
        restrictionService.restrictCommenting(bob, alice, Instant.now().plus(Duration.ofHours(1)), "noise");

        reportService.report(bob, comment, "spam");

        assertThat(openReportsOn(comment)).isEqualTo(1);
    }

    @Test
    void aCommentAModeratorLeftStandingComesBackOnlyAfterAnEdit() {
        var comment = commentOf(alice);
        var stored = comments.findById(comment).orElseThrow();
        // What a dismissal writes. Taken from updatedAt rather than the clock so that the two
        // timestamps are comparable without trusting two machines to agree.
        comments.saveAndFlush(stored.reportsClosedAt(stored.updatedAt()));

        reportService.report(bob, comment, "spam");
        assertThat(openReportsOn(comment)).isZero();

        comments.saveAndFlush(comments.findById(comment).orElseThrow().body("edited"));

        reportService.report(bob, comment, "spam");
        assertThat(openReportsOn(comment)).isEqualTo(1);
    }

    @Test
    void anUnknownReasonIsRejected() {
        var comment = commentOf(alice);

        assertThatThrownBy(() -> reportService.report(bob, comment, "because-i-say-so"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void reportingSomethingThatIsNotThere() {
        assertThatThrownBy(() -> reportService.report(bob, UUID.randomUUID(), "spam"))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    private UUID commentOf(UUID author) {
        return commentService
                .create(author, "article", subjectId, "reported")
                .comment()
                .id();
    }

    private void removeByModeration(UUID commentId) {
        var comment = comments.findById(commentId).orElseThrow();
        comments.saveAndFlush(comment.deletedAt(Instant.now())
                .hiddenAt(Instant.now())
                .hiddenSource(Comment.HIDDEN_BY_MODERATOR)
                .hiddenBy(UUID.randomUUID()));
    }

    private long openReportsOn(UUID commentId) {
        return reports.findAll().stream()
                .filter(r -> r.commentId().equals(commentId) && r.isOpen())
                .count();
    }
}
