package com.tenniswire.discussion_service;

import static org.assertj.core.api.Assertions.assertThat;

import com.tenniswire.discussion_service.entity.Report;
import com.tenniswire.discussion_service.entity.ReportResolution;
import com.tenniswire.discussion_service.repository.ReportRepository;
import com.tenniswire.discussion_service.service.CommentService;
import com.tenniswire.discussion_service.service.ModerationQueueService;
import com.tenniswire.discussion_service.service.QueuedComment;
import com.tenniswire.discussion_service.service.ReportService;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

// What a moderator is shown when the author rewrote the comment between the complaint and the card.
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ReportSnapshotIT {

    @Autowired
    private CommentService commentService;

    @Autowired
    private ReportService reportService;

    @Autowired
    private ModerationQueueService queue;

    @Autowired
    private ReportRepository reports;

    private final UUID subjectId = UUID.randomUUID();
    private final UUID alice = UUID.randomUUID();
    private final UUID bob = UUID.randomUUID();
    private final UUID carol = UUID.randomUUID();
    private final UUID moderator = UUID.randomUUID();

    @Test
    void withoutAnEditTheCardCarriesNoSecondCopy() {
        var his = comment("as reported");
        reportService.report(bob, his, "insult");

        assertThat(cardFor(his).bodyAtFirstReport()).isNull();
        assertThat(snapshotsOn(his)).containsOnlyNulls();
    }

    @Test
    void theCardShowsWhatWasReportedBesideWhatStandsThere() {
        var his = comment("as reported");
        reportService.report(bob, his, "insult");

        commentService.editOwn(alice, his, "rewritten in a hurry");

        var card = cardFor(his);
        assertThat(card.bodyAtFirstReport()).isEqualTo("as reported");
        assertThat(card.comment().body()).isEqualTo("rewritten in a hurry");
    }

    @Test
    void aSecondEditLeavesTheFirstComplaintsTextAlone() {
        var his = comment("as reported");
        reportService.report(bob, his, "insult");
        commentService.editOwn(alice, his, "second version");
        reportService.report(carol, his, "insult");

        commentService.editOwn(alice, his, "third version");

        // Carol's report holds the second version, but the card reads the earliest open one
        assertThat(snapshotsOn(his)).containsExactlyInAnyOrder("as reported", "second version");
        assertThat(cardFor(his).bodyAtFirstReport()).isEqualTo("as reported");
    }

    @Test
    void aDecisionTakesTheSnapshotWithTheHash() {
        var his = comment("as reported");
        reportService.report(bob, his, "insult");
        commentService.editOwn(alice, his, "rewritten");

        queue.resolve(his, ReportResolution.DISMISSED, moderator);

        assertThat(reportsOn(his)).singleElement().satisfies(report -> {
            assertThat(report.bodyAtReport()).isNull();
            assertThat(report.reporterHash()).isNull();
        });
    }

    @Test
    void aClosedReportIsNotGivenATextByALaterEdit() {
        var his = comment("as reported");
        reportService.report(bob, his, "insult");
        queue.resolve(his, ReportResolution.DISMISSED, moderator);

        commentService.editOwn(alice, his, "rewritten after the decision");

        assertThat(snapshotsOn(his)).containsOnlyNulls();
    }

    private UUID comment(String body) {
        return commentService
                .create(alice, "publication", subjectId, body)
                .comment()
                .id();
    }

    private QueuedComment cardFor(UUID commentId) {
        return queue.open(0, ModerationQueueService.MAX_PAGE_SIZE).stream()
                .filter(card -> card.comment().id().equals(commentId))
                .findFirst()
                .orElseThrow();
    }

    private List<Report> reportsOn(UUID commentId) {
        return reports.findAll().stream()
                .filter(report -> report.commentId().equals(commentId))
                .toList();
    }

    private List<String> snapshotsOn(UUID commentId) {
        return reportsOn(commentId).stream().map(Report::bodyAtReport).toList();
    }
}
