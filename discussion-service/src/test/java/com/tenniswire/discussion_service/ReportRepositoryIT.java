package com.tenniswire.discussion_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.tenniswire.discussion_service.entity.Comment;
import com.tenniswire.discussion_service.entity.Report;
import com.tenniswire.discussion_service.entity.ReportResolution;
import com.tenniswire.discussion_service.repository.CommentRepository;
import com.tenniswire.discussion_service.repository.ReportRepository;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ReportRepositoryIT {

    private static final byte[] HASH = {1, 2, 3};

    @Autowired
    private ReportRepository reports;

    @Autowired
    private CommentRepository comments;

    @Test
    void oneOpenReportPerReporterAndComment() {
        var first = comment();
        var second = comment();
        reports.saveAndFlush(byReader(first, HASH));

        assertThatThrownBy(() -> reports.saveAndFlush(byReader(first, HASH)))
                .isInstanceOf(DataIntegrityViolationException.class);
        // The same reader complaining about a different comment is a different complaint.
        assertThat(reports.saveAndFlush(byReader(second, HASH)).id()).isNotNull();
    }

    @Test
    void closingAReportFreesTheReaderToComplainAgain() {
        var comment = comment();
        var report = reports.saveAndFlush(byReader(comment, HASH));

        // What resolving does: the decision is kept, the reporter is forgotten.
        reports.saveAndFlush(report.resolvedAt(Instant.now())
                .resolution(ReportResolution.DISMISSED)
                .resolvedBy(UUID.randomUUID())
                .reporterHash(null));

        assertThat(reports.saveAndFlush(byReader(comment, HASH)).id()).isNotNull();
    }

    @Test
    void anOpenReportCarriesAHashExactlyWhenAReaderFiledIt() {
        var comment = comment();

        assertThatThrownBy(() -> reports.saveAndFlush(byReader(comment, null)))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> reports.saveAndFlush(byBot(comment).reporterHash(HASH)))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThat(reports.saveAndFlush(byBot(comment)).id()).isNotNull();
    }

    @Test
    void oneOpenReportPerCommentFromTheBot() {
        var comment = comment();
        var first = reports.saveAndFlush(byBot(comment));

        assertThatThrownBy(() -> reports.saveAndFlush(byBot(comment)))
                .isInstanceOf(DataIntegrityViolationException.class);

        reports.saveAndFlush(first.resolvedAt(Instant.now()).resolution(ReportResolution.HIDDEN));
        assertThat(reports.saveAndFlush(byBot(comment)).id()).isNotNull();
    }

    @Test
    void aDecisionAndItsTimeAreWrittenTogether() {
        var report = reports.saveAndFlush(byReader(comment(), HASH));

        assertThatThrownBy(() -> reports.saveAndFlush(report.resolution(ReportResolution.HIDDEN)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void removingACommentRemovesItsReports() {
        var comment = comment();
        var report = reports.saveAndFlush(byReader(comment, HASH));

        // The erase flow deletes a departed author's childless comments outright.
        comments.deleteById(comment);

        assertThat(reports.existsById(report.id())).isFalse();
    }

    @Test
    void aRemovalNamesAModeratorUnlessTheBotMadeIt() {
        assertThatThrownBy(() -> hide(loaded(comment()), Comment.HIDDEN_BY_BOT, UUID.randomUUID()))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> hide(loaded(comment()), Comment.HIDDEN_BY_MODERATOR, null))
                .isInstanceOf(DataIntegrityViolationException.class);

        assertThat(hide(loaded(comment()), Comment.HIDDEN_BY_BOT, null).hiddenAt())
                .isNotNull();
        assertThat(hide(loaded(comment()), Comment.HIDDEN_BY_MODERATOR, UUID.randomUUID())
                        .hiddenAt())
                .isNotNull();
    }

    /**
     * Whether a comment a moderator let stand has been edited since is read off updatedAt, so
     * writing moderation state must not touch it. The trigger fires on a body change only.
     */
    @Test
    void recordingARemovalIsNotAnEdit() {
        var comment = loaded(comment());
        var untouched = comment.updatedAt();

        var hidden = hide(comment, Comment.HIDDEN_BY_MODERATOR, UUID.randomUUID());

        assertThat(hidden.updatedAt()).isEqualTo(untouched);
        assertThat(loaded(hidden.id()).updatedAt()).isEqualTo(untouched);
    }

    private Comment hide(Comment comment, String source, UUID moderator) {
        return comments.saveAndFlush(comment.hiddenAt(Instant.now())
                .hiddenSource(source)
                .hiddenBy(moderator)
                .deletedAt(Instant.now()));
    }

    private UUID comment() {
        return comments.saveAndFlush(new Comment()
                        .subjectType("article")
                        .subjectId(UUID.randomUUID())
                        .authorId(UUID.randomUUID())
                        .body("reported"))
                .id();
    }

    private Comment loaded(UUID id) {
        return comments.findById(id).orElseThrow();
    }

    private static Report byReader(UUID commentId, byte[] hash) {
        return new Report()
                .commentId(commentId)
                .source(Report.SOURCE_USER)
                .reporterHash(hash)
                .reason("spam");
    }

    private static Report byBot(UUID commentId) {
        return new Report().commentId(commentId).source(Report.SOURCE_BOT).reason("spam");
    }
}
