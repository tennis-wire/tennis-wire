package com.tenniswire.discussion_service.service;

import static com.tenniswire.discussion_service.TwoWriters.PATIENCE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.doAnswer;

import com.tenniswire.discussion_service.TestcontainersConfiguration;
import com.tenniswire.discussion_service.TwoWriters;
import com.tenniswire.discussion_service.config.TextExpiryProperties;
import com.tenniswire.discussion_service.entity.Report;
import com.tenniswire.discussion_service.entity.ReportResolution;
import com.tenniswire.discussion_service.exception.ResourceNotFoundException;
import com.tenniswire.discussion_service.repository.CommentRepository;
import com.tenniswire.discussion_service.repository.ReportRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

// The pass is driven here rather than left to its clock, and a comment is put past the term by moving
// its deleted_at back. In the races the first writer stops once it holds its trees.
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class TextExpiryIT {

    @MockitoSpyBean
    private TreeLock treeLock;

    @Autowired
    private TextExpiryWriter writer;

    @Autowired
    private TextExpiryProperties properties;

    @Autowired
    private CommentService commentService;

    @Autowired
    private ReportService reportService;

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

    private TextExpiryJob job;
    private TwoWriters writers;

    @BeforeEach
    void aJobOfItsOwnAndAFirstWriterThatStopsOnItsTrees() {
        // Built here: the bean is switched off under test
        job = new TextExpiryJob(writer, properties);
        writers = new TwoWriters(dataSource);
        doAnswer(call -> {
                    call.callRealMethod();
                    writers.stopTheFirst();
                    return null;
                })
                .when(treeLock)
                .hold(anyCollection());
    }

    @Test
    void aCommentItsAuthorDeletedKeepsItsPlaceWithoutItsText() {
        var his = comment(alice, "his");
        var hers = commentService.reply(bob, his, "keeps the node").comment().id();
        commentService.deleteOwn(alice, his);
        downLongAgo(his);
        var before = comments.findById(his).orElseThrow();

        job.pass();

        var after = comments.findById(his).orElseThrow();
        assertThat(after.body()).isNull();
        assertThat(after.authorId()).isEqualTo(alice);
        assertThat(after.replyCount()).isEqualTo(before.replyCount());
        assertThat(after.updatedAt()).isEqualTo(before.updatedAt());
        assertThat(comments.findById(hers).orElseThrow().body()).isEqualTo("keeps the node");
    }

    @Test
    void aCommentModerationRemovedLosesItsTextAndStillCountsAgainstItsAuthor() {
        var his = comment(alice, "his");
        commentService.hideByModerator(his, moderator);
        downLongAgo(his);

        job.pass();

        var after = comments.findById(his).orElseThrow();
        assertThat(after.body()).isNull();
        assertThat(after.isHiddenByModeration()).isTrue();
        assertThat(comments.countRemovalsAmong(List.of(alice), Instant.now().minus(properties.after())))
                .singleElement()
                .satisfies(tally -> assertThat(tally.total()).isEqualTo(1L));
    }

    @Test
    void aCommentDownForLessThanTheTermKeepsItsText() {
        var his = comment(alice, "his");
        commentService.hideByModerator(his, moderator);

        job.pass();

        assertThat(comments.findById(his).orElseThrow().body()).isEqualTo("his");
    }

    @Test
    void anOpenCardClosesWithTheText() {
        var his = reportedThenDeletedLongAgo();

        job.pass();

        assertThat(reportsOn(his)).singleElement().satisfies(report -> {
            assertThat(report.resolution()).isEqualTo(ReportResolution.EXPIRED);
            assertThat(report.resolvedBy()).isNull();
            assertThat(report.reporterHash()).isNull();
        });
        assertThat(queue.open(0, ModerationQueueService.MAX_PAGE_SIZE))
                .noneMatch(card -> card.comment().id().equals(his));
    }

    @Test
    void theSnapshotOfAReportedTextGoesWithTheTextItself() {
        var his = comment(alice, "as reported");
        reportService.report(bob, his, "spam");
        commentService.editOwn(alice, his, "rewritten");
        commentService.deleteOwn(alice, his);
        downLongAgo(his);

        job.pass();

        assertThat(reportsOn(his)).singleElement().satisfies(report -> {
            assertThat(report.resolution()).isEqualTo(ReportResolution.EXPIRED);
            assertThat(report.bodyAtReport()).isNull();
        });
    }

    @Test
    void onePassGoesOnPastAFullBatch() {
        var inTwos = new TextExpiryJob(writer, new TextExpiryProperties(properties.after(), 2));
        var down = new ArrayList<UUID>();
        for (var i = 0; i < 5; i++) {
            var his = comment(alice, "one of several " + i);
            commentService.hideByModerator(his, moderator);
            downLongAgo(his);
            down.add(his);
        }

        inTwos.pass();

        assertThat(comments.findAllById(down)).hasSize(5).allSatisfy(c -> assertThat(c.body())
                .isNull());
    }

    @Test
    void anInstanceThatFindsTheWipeTakenLeavesItToTheOther() throws Exception {
        var his = comment(alice, "his");
        commentService.hideByModerator(his, moderator);
        downLongAgo(his);

        try (var other = dataSource.getConnection()) {
            other.setAutoCommit(false);
            try (var lock = other.createStatement()) {
                lock.execute("select pg_advisory_xact_lock(2, 0)");
            }
            job.pass();
            assertThat(comments.findById(his).orElseThrow().body()).isEqualTo("his");
            other.rollback();
        }

        job.pass();

        assertThat(comments.findById(his).orElseThrow().body()).isNull();
    }

    @Test
    void aDecisionThatWaitedForTheWipeFindsTheCardClosed() throws Exception {
        var his = reportedThenDeletedLongAgo();

        var late = writers.race(job::pass, () -> queue.resolve(his, ReportResolution.COUNTED, moderator));

        assertThat(late)
                .failsWithin(PATIENCE)
                .withThrowableOfType(ExecutionException.class)
                .withCauseInstanceOf(ResourceNotFoundException.class);
        assertThat(comments.findById(his).orElseThrow().countedAt()).isNull();
        assertThat(reportsOn(his)).extracting(Report::resolution).containsOnly(ReportResolution.EXPIRED);
    }

    @Test
    void aWipeThatWaitedForTheDecisionTakesTheTextOfACountedComment() throws Exception {
        var his = reportedThenDeletedLongAgo();

        var late = writers.race(() -> queue.resolve(his, ReportResolution.COUNTED, moderator), job::pass);

        assertThat(late).succeedsWithin(PATIENCE);
        var after = comments.findById(his).orElseThrow();
        assertThat(after.countedAt()).isNotNull();
        assertThat(after.body()).isNull();
        assertThat(reportsOn(his)).extracting(Report::resolution).containsOnly(ReportResolution.COUNTED);
    }

    // A card a moderator can still count and a text the wipe is due to take, on the same comment
    private UUID reportedThenDeletedLongAgo() {
        var his = comment(alice, "his");
        reportService.report(bob, his, "spam");
        commentService.deleteOwn(alice, his);
        downLongAgo(his);
        return his;
    }

    private List<Report> reportsOn(UUID commentId) {
        return reports.findAll().stream()
                .filter(report -> report.commentId().equals(commentId))
                .toList();
    }

    private UUID comment(UUID author, String body) {
        return commentService
                .create(author, "publication", subjectId, body)
                .comment()
                .id();
    }

    private void downLongAgo(UUID commentId) {
        new JdbcTemplate(dataSource)
                .update("update comment set deleted_at = now() - interval '31 days' where id = ?", commentId);
    }
}
