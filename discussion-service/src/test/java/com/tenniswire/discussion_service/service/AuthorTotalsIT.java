package com.tenniswire.discussion_service.service;

import static com.tenniswire.discussion_service.TwoWriters.PATIENCE;
import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;

import com.tenniswire.discussion_service.TestcontainersConfiguration;
import com.tenniswire.discussion_service.TwoWriters;
import com.tenniswire.discussion_service.config.AuthorTotalsProperties;
import com.tenniswire.discussion_service.entity.AuthorReactionChange;
import com.tenniswire.discussion_service.repository.AuthorReactionChangeRepository;
import com.tenniswire.discussion_service.repository.AuthorReactionTotalRepository;
import java.sql.SQLException;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

// The fold is driven here rather than left to its clock. Alice writes; bob and carol react.
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class AuthorTotalsIT {

    @Autowired
    private AuthorTotals totals;

    @Autowired
    private AuthorTotalsProperties properties;

    @Autowired
    private CommentService commentService;

    @Autowired
    private ReactionService reactions;

    @Autowired
    private RestrictionService restrictions;

    @Autowired
    private ReaderErasure erasure;

    @Autowired
    private AuthorReactionChangeRepository changes;

    @Autowired
    private AuthorReactionTotalRepository totalRows;

    @Autowired
    private DataSource dataSource;

    private final UUID subjectId = UUID.randomUUID();
    private final UUID alice = UUID.randomUUID();
    private final UUID bob = UUID.randomUUID();
    private final UUID carol = UUID.randomUUID();
    private final UUID moderator = UUID.randomUUID();

    private AuthorTotalsJob job;

    @BeforeEach
    void aJobOfItsOwn() {
        // Built here: the bean is switched off under test
        job = new AuthorTotalsJob(totals, properties);
    }

    @Test
    void nothingShowsBeforeTheFoldAndEverythingAfter() {
        var one = comment(alice, "one");
        var two = comment(alice, "two");
        reactions.setVote(bob, one, "like");
        reactions.setVote(carol, one, "dislike");
        reactions.setEmoji(bob, two, "clown");

        assertThat(reactions.totalsOf(alice)).isEqualTo(AuthorReactions.NONE);
        job.pass();

        assertThat(reactions.totalsOf(alice)).isEqualTo(new AuthorReactions(1, 1, Map.of("clown", 1L)));
        assertThat(pendingFor(alice)).isZero();
    }

    @Test
    void aReactionChangedOrTakenBackIsCountedAsItEndedUp() {
        var hers = comment(alice, "hers");
        reactions.setVote(carol, hers, "like");
        job.pass();

        reactions.setVote(bob, hers, "like");
        reactions.setVote(bob, hers, "dislike");
        reactions.setEmoji(bob, hers, "laugh");
        reactions.setEmoji(bob, hers, "clown");
        reactions.clearVote(carol, hers);
        job.pass();

        assertThat(reactions.totalsOf(alice)).isEqualTo(new AuthorReactions(0, 1, Map.of("clown", 1L)));
    }

    @Test
    void aCommentTakenDownKeepsWhatItCollectedForItsAuthor() {
        var deleted = comment(alice, "deleted by her");
        var removed = comment(alice, "removed by moderation");
        reactions.setVote(bob, deleted, "like");
        job.pass();
        // Not folded yet when it comes down, and counted all the same
        reactions.setVote(bob, removed, "like");

        commentService.deleteOwn(alice, deleted);
        commentService.hideByModerator(removed, moderator);
        job.pass();

        assertThat(reactions.totalsOf(alice).likeCount()).isEqualTo(2);
    }

    @Test
    void aBanThatTakesHisCommentsDownLeavesWhatTheyCollected() {
        var hers = comment(alice, "hers");
        reactions.setVote(bob, hers, "like");

        restrictions.restrictCommenting(alice, moderator, null, "spam", false, true);
        job.pass();

        assertThat(reactions.totalsOf(alice).likeCount()).isEqualTo(1);
    }

    @Test
    void aBanThatTakesBackHisReactionsTakesThemOffTheTotals() {
        var one = comment(alice, "one");
        var two = comment(alice, "two");
        reactions.setVote(bob, one, "like");
        reactions.setEmoji(bob, two, "vomit");
        reactions.setVote(carol, one, "like");
        job.pass();

        restrictions.restrictCommenting(bob, moderator, null, "done with him", true);
        job.pass();

        assertThat(reactions.totalsOf(alice)).isEqualTo(new AuthorReactions(1, 0, Map.of()));
    }

    @Test
    void anErasedReaderTakesHisTotalAndHisReactionsWithHim() {
        var hers = comment(alice, "hers");
        var his = comment(bob, "his");
        reactions.setVote(alice, his, "like");
        reactions.setVote(bob, hers, "like");
        job.pass();
        // Still on its way when she goes
        reactions.setEmoji(carol, hers, "laugh");

        erasure.erase(alice);
        job.pass();

        assertThat(totalRows.findById(alice)).isEmpty();
        assertThat(pendingFor(alice)).isZero();
        assertThat(reactions.totalsOf(bob).likeCount()).isZero();
    }

    @Test
    void onePassGoesOnPastAFullBatch() {
        var inTwos = new AuthorTotalsJob(totals, new AuthorTotalsProperties(2));
        for (var i = 0; i < 5; i++) {
            reactions.setVote(bob, comment(alice, "one of several " + i), "like");
        }

        inTwos.pass();

        assertThat(reactions.totalsOf(alice).likeCount()).isEqualTo(5);
        assertThat(pendingFor(alice)).isZero();
    }

    @Test
    void anInstanceThatFindsTheFoldTakenLeavesItToTheOther() throws Exception {
        reactions.setVote(bob, comment(alice, "hers"), "like");

        try (var other = dataSource.getConnection()) {
            other.setAutoCommit(false);
            try (var lock = other.createStatement()) {
                lock.execute("select pg_advisory_xact_lock(5, 0)");
            }
            job.pass();
            assertThat(reactions.totalsOf(alice)).isEqualTo(AuthorReactions.NONE);
            other.rollback();
        }

        job.pass();

        assertThat(reactions.totalsOf(alice).likeCount()).isEqualTo(1);
    }

    // The first writer stands in for a fold that has read her changes and is writing her total. An
    // erasure that did not wait for it would find no row to delete and leave the one written after.
    @Test
    void anErasureWaitsOutAFoldInProgressRatherThanLeaveHerTotalBehind() throws Exception {
        var writers = new TwoWriters(dataSource);

        var late = writers.race(() -> foldWritingATotalFor(alice, writers), () -> erasure.erase(alice));
        late.get(PATIENCE.toSeconds(), SECONDS);

        assertThat(totalRows.findById(alice)).isEmpty();
    }

    private void foldWritingATotalFor(UUID authorId, TwoWriters writers) {
        try (var fold = dataSource.getConnection()) {
            fold.setAutoCommit(false);
            try (var lock = fold.createStatement()) {
                lock.execute("select pg_advisory_xact_lock(5, 0)");
            }
            try (var insert =
                    fold.prepareStatement("insert into author_reaction_total (author_id, like_count) values (?, 1)")) {
                insert.setObject(1, authorId);
                insert.executeUpdate();
            }
            writers.stopTheFirst();
            fold.commit();
        } catch (SQLException e) {
            throw new IllegalStateException(e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }

    private UUID comment(UUID authorId, String body) {
        return commentService
                .create(authorId, "publication", subjectId, body)
                .comment()
                .id();
    }

    private long pendingFor(UUID authorId) {
        return changes.findAll().stream()
                .map(AuthorReactionChange::authorId)
                .filter(authorId::equals)
                .count();
    }
}
