package com.tenniswire.discussion_service.service;

import static com.tenniswire.discussion_service.TwoWriters.PATIENCE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;

import com.tenniswire.discussion_service.TestcontainersConfiguration;
import com.tenniswire.discussion_service.TwoWriters;
import com.tenniswire.discussion_service.entity.Comment;
import com.tenniswire.discussion_service.entity.ReportResolution;
import com.tenniswire.discussion_service.exception.ParentDeletedException;
import com.tenniswire.discussion_service.exception.ResolutionNotApplicableException;
import com.tenniswire.discussion_service.exception.ResourceNotFoundException;
import com.tenniswire.discussion_service.repository.CommentRepository;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

// Two writers on one tree, the first stopped right after its collapse, before it commits. Without the
// tree lock the second waits on a row instead, works from counts the first is about to commit, and
// every case below ends in a state or an error that shows it.
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class TreeLockIT {

    @MockitoSpyBean
    private CommentCollapse collapse;

    @Autowired
    private CommentService commentService;

    @Autowired
    private ReaderErasure erasure;

    @Autowired
    private ReportService reportService;

    @Autowired
    private ModerationQueueService queue;

    @Autowired
    private CommentRepository rows;

    @Autowired
    private DataSource dataSource;

    private final UUID subjectId = UUID.randomUUID();
    private final UUID alice = UUID.randomUUID();
    private final UUID bob = UUID.randomUUID();
    private final UUID carol = UUID.randomUUID();
    private final UUID dave = UUID.randomUUID();

    private TwoWriters writers;

    @BeforeEach
    void stopTheFirstWriterAfterItsCollapse() {
        writers = new TwoWriters(dataSource);
        doAnswer(call -> {
                    var taken = call.callRealMethod();
                    writers.stopTheFirst();
                    return taken;
                })
                .when(collapse)
                .of(any(), any());
    }

    @Test
    void repliesDeletedAtOnceTakeThePlaceholderAboveThemAlong() throws Exception {
        var root = comment(alice);
        var placeholder = reply(bob, root);
        var carols = reply(carol, placeholder);
        var daves = reply(dave, placeholder);
        commentService.deleteOwn(bob, placeholder.id());

        var late = writers.race(
                () -> commentService.deleteOwn(carol, carols.id()), () -> commentService.deleteOwn(dave, daves.id()));

        assertThat(late).succeedsWithin(PATIENCE);
        assertThat(rows.findById(placeholder.id())).isEmpty();
        assertThat(replyCountOf(root)).isZero();
    }

    @Test
    void anEraseBesideARemovalCountsTheEmptiedPlaceholderOut() throws Exception {
        var root = comment(alice);
        var placeholder = reply(bob, root);
        var carols = reply(carol, placeholder);
        reply(dave, placeholder);
        commentService.deleteOwn(bob, placeholder.id());

        var late = writers.race(
                () -> commentService.hideByModerator(carols.id(), UUID.randomUUID()), () -> erasure.erase(dave));

        assertThat(late).succeedsWithin(PATIENCE);
        // the removed reply keeps its row, and that row keeps the placeholder's; neither is shown
        assertThat(rows.findById(placeholder.id())).isPresent();
        assertThat(replyCountOf(root)).isZero();
    }

    @Test
    void aReplyToACommentThatWentMeanwhileIsNotFound() throws Exception {
        var root = comment(alice);
        var leaf = reply(bob, root);

        var late = writers.race(
                () -> commentService.deleteOwn(bob, leaf.id()),
                () -> commentService.reply(carol, leaf.id(), "too late"));

        assertThat(late)
                .failsWithin(PATIENCE)
                .withThrowableOfType(ExecutionException.class)
                .withCauseInstanceOf(ResourceNotFoundException.class);
        assertThat(replyCountOf(root)).isZero();
    }

    @Test
    void aReplyThatWaitedFindsItsParentDown() throws Exception {
        var root = comment(alice);
        var parent = reply(bob, root);
        reply(carol, parent);

        var late = writers.race(
                () -> commentService.deleteOwn(bob, parent.id()),
                () -> commentService.reply(dave, parent.id(), "too late"));

        assertThat(late)
                .failsWithin(PATIENCE)
                .withThrowableOfType(ExecutionException.class)
                .withCauseInstanceOf(ParentDeletedException.class);
        assertThat(replyCountOf(parent)).isOne();
    }

    @Test
    void aReportOnACommentThatWentMeanwhileIsNotFound() throws Exception {
        var root = comment(alice);
        var leaf = reply(bob, root);

        var late = writers.race(
                () -> commentService.deleteOwn(bob, leaf.id()), () -> reportService.report(carol, leaf.id(), "spam"));

        assertThat(late)
                .failsWithin(PATIENCE)
                .withThrowableOfType(ExecutionException.class)
                .withCauseInstanceOf(ResourceNotFoundException.class);
    }

    // resolve reads the comment before it hands over to hideByModerator. A lock taken only there
    // would wait, then remove the comment as it was read before the wait: still standing.
    @Test
    void aCardDecidedWhileItsAuthorDeletesTheCommentIsNotRemoved() throws Exception {
        var root = comment(alice);
        var reported = reply(bob, root);
        reportService.report(carol, reported.id(), "spam");

        var late = writers.race(
                () -> commentService.deleteOwn(bob, reported.id()),
                () -> queue.resolve(reported.id(), ReportResolution.HIDDEN, UUID.randomUUID()));

        assertThat(late)
                .failsWithin(PATIENCE)
                .withThrowableOfType(ExecutionException.class)
                .withCauseInstanceOf(ResolutionNotApplicableException.class);
        assertThat(rows.findById(reported.id()).orElseThrow().isHiddenByModeration())
                .isFalse();
    }

    private Comment comment(UUID author) {
        return commentService.create(author, "publication", subjectId, "root").comment();
    }

    private Comment reply(UUID author, Comment parent) {
        return commentService.reply(author, parent.id(), "reply").comment();
    }

    private int replyCountOf(Comment comment) {
        return rows.findById(comment.id()).orElseThrow().replyCount();
    }
}
