package com.tenniswire.discussion_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.tenniswire.discussion_service.entity.Report;
import com.tenniswire.discussion_service.entity.ReportResolution;
import com.tenniswire.discussion_service.repository.AuthorReactionTotalRepository;
import com.tenniswire.discussion_service.repository.CommentReactionRepository;
import com.tenniswire.discussion_service.repository.CommentRepository;
import com.tenniswire.discussion_service.repository.ReportRepository;
import com.tenniswire.discussion_service.service.CommentService;
import com.tenniswire.discussion_service.service.CommentSort;
import com.tenniswire.discussion_service.service.CommentView;
import com.tenniswire.discussion_service.service.ReactionService;
import com.tenniswire.discussion_service.service.ReportService;
import com.tenniswire.discussion_service.service.RestrictionService;
import com.tenniswire.discussion_service.service.Visibility;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class BanSweepIT {

    @Autowired
    private RestrictionService restrictionService;

    @Autowired
    private CommentService commentService;

    @Autowired
    private ReportService reportService;

    @Autowired
    private ReactionService reactionService;

    @Autowired
    private CommentRepository comments;

    @Autowired
    private ReportRepository reports;

    @Autowired
    private CommentReactionRepository reactions;

    @Autowired
    private AuthorReactionTotalRepository totals;

    private final UUID subjectId = UUID.randomUUID();
    private final UUID spammer = UUID.randomUUID();
    private final UUID reader = UUID.randomUUID();
    private final UUID moderator = UUID.randomUUID();

    @Test
    void everythingHeHasStandingComesDownSignedByTheModerator() {
        var one = comment(spammer, "one");
        var two = comment(spammer, "two");

        restrictionService.restrictCommenting(spammer, moderator, null, "spam", false, true);

        assertThat(comments.findAllById(List.of(one, two))).hasSize(2).allSatisfy(comment -> {
            assertThat(comment.isDeleted()).isTrue();
            assertThat(comment.hiddenAt()).isNotNull();
            assertThat(comment.hiddenBy()).isEqualTo(moderator);
        });
        assertThat(restrictionService.activeFor(spammer)).hasSize(1);
        assertThat(listed()).isEmpty();
    }

    @Test
    void aReplyUnderHisCommentKeepsItAsAPlaceholder() {
        var his = comment(spammer, "his");
        var answer = commentService.reply(reader, his, "answer").comment();

        restrictionService.restrictCommenting(spammer, moderator, null, "spam", false, true);

        var listed = listed();
        assertThat(listed).hasSize(1);
        assertThat(listed.getFirst().visibility()).isEqualTo(Visibility.REMOVED);
        assertThat(comments.findById(answer.id()).orElseThrow().isDeleted()).isFalse();
    }

    @Test
    void hisReplyComesOffTheParentsCount() {
        var top = comment(reader, "top");
        commentService.reply(spammer, top, "buy now");

        restrictionService.restrictCommenting(spammer, moderator, null, "spam", false, true);

        assertThat(comments.findById(top).orElseThrow().replyCount()).isZero();
    }

    @Test
    void whatHeDeletedHimselfStaysHisOwnDeletion() {
        var deleted = comment(spammer, "deleted");
        // the answer keeps the row: a deletion with nothing under it goes from the table
        commentService.reply(reader, deleted, "keeps the node");
        commentService.deleteOwn(spammer, deleted);

        restrictionService.restrictCommenting(spammer, moderator, null, "spam", false, true);

        assertThat(comments.findById(deleted))
                .hasValueSatisfying(comment -> assertThat(comment.hiddenAt()).isNull());
    }

    @Test
    void openReportsOnThemAreClosedAsRemovedByTheModerator() {
        var reported = comment(spammer, "reported");
        reportService.report(reader, reported, "spam");

        restrictionService.restrictCommenting(spammer, moderator, null, "spam", false, true);

        assertThat(reportsOn(reported)).isNotEmpty().allSatisfy(report -> {
            assertThat(report.resolution()).isEqualTo(ReportResolution.HIDDEN);
            assertThat(report.resolvedBy()).isEqualTo(moderator);
        });
    }

    @Test
    void whatTheyCollectedGoesToHisTotal() {
        var liked = comment(spammer, "liked");
        reactionService.setVote(reader, liked, "like");

        restrictionService.restrictCommenting(spammer, moderator, null, "spam", false, true);

        assertThat(reactions.findByCommentIdIn(List.of(liked))).isEmpty();
        assertThat(totals.findById(spammer).orElseThrow().likeCount()).isEqualTo(1);
    }

    @Test
    void aBanLeavesThemStandingUnlessAsked() {
        var kept = comment(spammer, "kept");

        restrictionService.restrictCommenting(spammer, moderator, null, "quiet for now");

        assertThat(comments.findById(kept).orElseThrow().isDeleted()).isFalse();
    }

    @Test
    void aTemporaryBanMayNotTakeThemDown() {
        var kept = comment(spammer, "kept");

        assertThatThrownBy(() -> restrictionService.restrictCommenting(
                        spammer, moderator, Instant.now().plus(Duration.ofHours(1)), "flood", false, true))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(comments.findById(kept).orElseThrow().isDeleted()).isFalse();
        assertThat(restrictionService.activeFor(spammer)).isEmpty();
    }

    @Test
    void aSweepWithNothingStandingIsJustABan() {
        restrictionService.restrictCommenting(spammer, moderator, null, "spam", false, true);

        assertThat(restrictionService.activeFor(spammer)).hasSize(1);
    }

    private UUID comment(UUID author, String body) {
        return commentService
                .create(author, "publication", subjectId, body)
                .comment()
                .id();
    }

    private List<CommentView> listed() {
        return commentService
                .listTopLevel("publication", subjectId, null, null, null, CommentSort.OLDEST)
                .items();
    }

    private List<Report> reportsOn(UUID commentId) {
        return reports.findAll().stream()
                .filter(report -> report.commentId().equals(commentId))
                .toList();
    }
}
