package com.tenniswire.discussion_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.tenniswire.discussion_service.entity.ReportResolution;
import com.tenniswire.discussion_service.exception.CommentAlreadyRemovedException;
import com.tenniswire.discussion_service.exception.CommentDeletedException;
import com.tenniswire.discussion_service.exception.CommentingRestrictedException;
import com.tenniswire.discussion_service.exception.EditWindowClosedException;
import com.tenniswire.discussion_service.exception.ForbiddenException;
import com.tenniswire.discussion_service.repository.CommentRepository;
import com.tenniswire.discussion_service.repository.ReportRepository;
import com.tenniswire.discussion_service.service.CommentService;
import com.tenniswire.discussion_service.service.ModerationQueueService;
import com.tenniswire.discussion_service.service.ReportService;
import com.tenniswire.discussion_service.service.RestrictionService;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class CommentEditIT {

    @Autowired
    private CommentService commentService;

    @Autowired
    private ReportService reportService;

    @Autowired
    private RestrictionService restrictionService;

    @Autowired
    private ModerationQueueService queue;

    @Autowired
    private CommentRepository comments;

    @Autowired
    private ReportRepository reports;

    @Autowired
    private DataSource dataSource;

    private final UUID subjectId = UUID.randomUUID();
    private final UUID alice = UUID.randomUUID();
    private final UUID bob = UUID.randomUUID();
    private final UUID moderator = UUID.randomUUID();

    @Test
    void theAuthorChangesHisText() {
        var his = comment(alice, "frist");

        commentService.editOwn(alice, his, "first");

        var after = comments.findById(his).orElseThrow();
        assertThat(after.body()).isEqualTo("first");
        assertThat(after.isEdited()).isTrue();
        assertThat(after.updatedAt()).isAfter(after.createdAt());
    }

    @Test
    void aFreshCommentDoesNotCountAsEdited() {
        var his = comments.findById(comment(alice, "as written")).orElseThrow();

        assertThat(his.isEdited()).isFalse();
    }

    @Test
    void nobodyElseMay() {
        var his = comment(alice, "his");

        assertThatThrownBy(() -> commentService.editOwn(bob, his, "not his to change"))
                .isInstanceOf(ForbiddenException.class);
        assertThat(comments.findById(his).orElseThrow().body()).isEqualTo("his");
    }

    @Test
    void theSameTextIsNotAnEdit() {
        var his = comment(alice, "unchanged");
        var before = comments.findById(his).orElseThrow().updatedAt();

        commentService.editOwn(alice, his, "unchanged");

        var after = comments.findById(his).orElseThrow();
        assertThat(after.updatedAt()).isEqualTo(before);
        assertThat(after.isEdited()).isFalse();
    }

    @Test
    void pastTheWindowHeMayNoLonger() {
        var his = comment(alice, "his");
        publishedLongAgo(his);

        assertThatThrownBy(() -> commentService.editOwn(alice, his, "too late"))
                .isInstanceOf(EditWindowClosedException.class);
        assertThat(comments.findById(his).orElseThrow().body()).isEqualTo("his");
    }

    @Test
    void notUnderARestriction() {
        var his = comment(alice, "his");
        restrictionService.restrictCommenting(alice, moderator, Instant.now().plus(Duration.ofHours(1)), "flood");

        assertThatThrownBy(() -> commentService.editOwn(alice, his, "still banned"))
                .isInstanceOf(CommentingRestrictedException.class);
    }

    @Test
    void notOneHeTookDownHimself() {
        var his = comment(alice, "his");
        commentService.reply(bob, his, "keeps the node");
        commentService.deleteOwn(alice, his);

        assertThatThrownBy(() -> commentService.editOwn(alice, his, "gone"))
                .isInstanceOf(CommentDeletedException.class);
    }

    @Test
    void oneModerationRemovedIsToldApartFromOneHeDeleted() {
        var his = comment(alice, "his");
        commentService.reply(bob, his, "keeps the node");
        commentService.hideByModerator(his, moderator);

        assertThatThrownBy(() -> commentService.editOwn(alice, his, "gone"))
                .isInstanceOf(CommentAlreadyRemovedException.class);
    }

    @Test
    void anEditPutsBackACommentAModeratorLetStand() {
        var his = comment(alice, "borderline");
        reportService.report(bob, his, "insult");
        queue.resolve(his, ReportResolution.DISMISSED, moderator);
        assertThat(openReportsOn(his)).isZero();

        commentService.editOwn(alice, his, "over the line now");
        reportService.report(bob, his, "insult");

        assertThat(openReportsOn(his)).isEqualTo(1);
    }

    private UUID comment(UUID author, String body) {
        return commentService
                .create(author, "publication", subjectId, body)
                .comment()
                .id();
    }

    // The window is counted from created_at, so the comment is moved rather than the clock. updated_at
    // goes with it: left where it was it would read as an edit that never happened.
    private void publishedLongAgo(UUID commentId) {
        new JdbcTemplate(dataSource).update("""
                        update comment
                        set created_at = now() - interval '1 hour', updated_at = now() - interval '1 hour'
                        where id = ?
                        """, commentId);
    }

    private long openReportsOn(UUID commentId) {
        return reports.findAll().stream()
                .filter(report -> report.commentId().equals(commentId) && report.isOpen())
                .count();
    }
}
