package com.tenniswire.discussion_service.service;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;

import com.tenniswire.discussion_service.TestcontainersConfiguration;
import com.tenniswire.discussion_service.entity.Comment;
import com.tenniswire.discussion_service.exception.ParentDeletedException;
import com.tenniswire.discussion_service.exception.ResourceNotFoundException;
import com.tenniswire.discussion_service.repository.CommentRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

// Two writers on one tree. The first stops right after its collapse, before it commits; the second
// starts on the same tree, and the first is let go once the second has finished or is waiting on a
// lock. Without the tree lock the second waits on a row instead, works from counts the first is
// about to commit, and every case below ends in a state or an error that shows it.
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class TreeLockIT {

    private static final Duration PATIENCE = Duration.ofSeconds(10);

    private static final String WAITING_ON_A_LOCK = """
            select count(*) from pg_stat_activity
            where datname = current_database() and backend_type = 'client backend' and wait_event_type = 'Lock'
            """;

    @MockitoSpyBean
    private CommentCollapse collapse;

    @Autowired
    private CommentService commentService;

    @Autowired
    private ReaderErasure erasure;

    @Autowired
    private CommentRepository rows;

    @Autowired
    private DataSource dataSource;

    private final UUID subjectId = UUID.randomUUID();
    private final UUID alice = UUID.randomUUID();
    private final UUID bob = UUID.randomUUID();
    private final UUID carol = UUID.randomUUID();
    private final UUID dave = UUID.randomUUID();

    private final AtomicBoolean armed = new AtomicBoolean();
    private final CountDownLatch stopped = new CountDownLatch(1);
    private final CountDownLatch released = new CountDownLatch(1);

    // Only the first collapse after arming stops: the fixtures collapse too, and so does the second
    // writer.
    @BeforeEach
    void stopTheFirstCollapseOnceArmed() {
        doAnswer(call -> {
                    var taken = call.callRealMethod();
                    if (armed.compareAndSet(true, false)) {
                        stopped.countDown();
                        if (!released.await(PATIENCE.toSeconds(), SECONDS)) {
                            throw new IllegalStateException("The first writer was never let go");
                        }
                    }
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

        var late = race(
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

        var late =
                race(() -> commentService.hideByModerator(carols.id(), UUID.randomUUID()), () -> erasure.erase(dave));

        assertThat(late).succeedsWithin(PATIENCE);
        // the removed reply keeps its row, and that row keeps the placeholder's; neither is shown
        assertThat(rows.findById(placeholder.id())).isPresent();
        assertThat(replyCountOf(root)).isZero();
    }

    @Test
    void aReplyToACommentThatWentMeanwhileIsNotFound() throws Exception {
        var root = comment(alice);
        var leaf = reply(bob, root);

        var late = race(
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

        var late = race(
                () -> commentService.deleteOwn(bob, parent.id()),
                () -> commentService.reply(dave, parent.id(), "too late"));

        assertThat(late)
                .failsWithin(PATIENCE)
                .withThrowableOfType(ExecutionException.class)
                .withCauseInstanceOf(ParentDeletedException.class);
        assertThat(replyCountOf(parent)).isOne();
    }

    // Both writers are done by the time the second one's future comes back
    private Future<?> race(Runnable first, Runnable second) throws Exception {
        try (var pool = Executors.newFixedThreadPool(2)) {
            try {
                armed.set(true);
                var early = pool.submit(first);
                assertThat(stopped.await(PATIENCE.toSeconds(), SECONDS)).isTrue();
                var late = pool.submit(second);
                awaitDoneOrWaiting(late);
                released.countDown();
                early.get(PATIENCE.toSeconds(), SECONDS);
                return late;
            } finally {
                released.countDown();
            }
        }
    }

    // Any lock counts: a row when the tree lock is missing, the advisory lock when it is there. The
    // first writer cannot be the one waiting, it is stopped in Java.
    private void awaitDoneOrWaiting(Future<?> late) throws InterruptedException {
        var jdbc = new JdbcTemplate(dataSource);
        var deadline = Instant.now().plus(PATIENCE);
        while (!late.isDone()) {
            var waiting = jdbc.queryForObject(WAITING_ON_A_LOCK, Long.class);
            if (waiting != null && waiting > 0) {
                return;
            }
            assertThat(Instant.now())
                    .as("the second writer neither finished nor waited")
                    .isBefore(deadline);
            Thread.sleep(20);
        }
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
