package com.tenniswire.discussion_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.tenniswire.discussion_service.exception.DuplicateCommentException;
import com.tenniswire.discussion_service.exception.LinksNotYetException;
import com.tenniswire.discussion_service.exception.PostingTooFastException;
import com.tenniswire.discussion_service.exception.TooManyLinksException;
import com.tenniswire.discussion_service.service.CommentService;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

// The rules as they ship, over the test profile that turns the pace and the newcomer off for
// everyone else. The ceiling is lowered so that reaching it takes three comments, not a hundred.
@SpringBootTest(
        properties = {
            "discussion.posting.interval=5s",
            "discussion.posting.hourly-ceiling=3",
            "discussion.posting.newcomer.standing-comments=3",
            "discussion.posting.newcomer.interval=20s"
        })
@Import(TestcontainersConfiguration.class)
class PostingRulesIT {

    private static final String LONG = "Синнер сегодня подаёт заметно лучше, чем в Мадриде";

    @Autowired
    private CommentService commentService;

    @Autowired
    private JdbcTemplate jdbc;

    private final UUID here = UUID.randomUUID();
    private final UUID elsewhere = UUID.randomUUID();
    private final UUID moderator = UUID.randomUUID();

    @Test
    void aSecondCommentRightAwayMustWait() {
        var regular = settled();
        post(regular, here, "first");

        assertThatThrownBy(() -> post(regular, here, "second"))
                .isInstanceOfSatisfying(
                        PostingTooFastException.class,
                        ex -> assertThat(ex.retryAfterSeconds()).isBetween(1L, 5L));
    }

    @Test
    void aRegularMayGoOnOnceTheIntervalIsOver() {
        var regular = settled();
        backdate(post(regular, here, "first"), Duration.ofSeconds(6));

        post(regular, here, "second");
    }

    @Test
    void aNewcomerWaitsLonger() {
        var newcomer = UUID.randomUUID();
        backdate(post(newcomer, here, "first"), Duration.ofSeconds(6));

        assertThatThrownBy(() -> post(newcomer, here, "second")).isInstanceOf(PostingTooFastException.class);
    }

    @Test
    void theHourHasACeilingThatFreesWithItsEarliestComment() {
        var regular = settled();
        backdate(post(regular, here, "one"), Duration.ofMinutes(40));
        backdate(post(regular, here, "two"), Duration.ofMinutes(30));
        backdate(post(regular, here, "three"), Duration.ofMinutes(20));

        assertThatThrownBy(() -> post(regular, here, "four"))
                .isInstanceOfSatisfying(
                        PostingTooFastException.class,
                        ex -> assertThat(ex.retryAfterSeconds()).isBetween(19 * 60L, 20 * 60L + 1));
    }

    @Test
    void aNewcomerMayNotPostALink() {
        var newcomer = UUID.randomUUID();

        assertThatThrownBy(() -> post(newcomer, here, "смотрите https://example.com/odds"))
                .isInstanceOf(LinksNotYetException.class);
    }

    @Test
    void norReplyWithOne() {
        var parent = post(settled(), here, "top");

        assertThatThrownBy(() -> commentService.reply(UUID.randomUUID(), parent, "https://example.com"))
                .isInstanceOf(LinksNotYetException.class);
    }

    @Test
    void norEditOneIn() {
        var newcomer = UUID.randomUUID();
        var plain = post(newcomer, here, "plain");

        assertThatThrownBy(() -> commentService.editOwn(newcomer, plain, "plain https://example.com"))
                .isInstanceOf(LinksNotYetException.class);
    }

    @Test
    void aRegularPostsLinksUpToTheLimit() {
        var regular = settled();
        backdate(post(regular, here, "https://a.example https://b.example https://c.example"), Duration.ofSeconds(6));

        assertThatThrownBy(() ->
                        post(regular, here, "https://a.example https://b.example https://c.example https://d.example"))
                .isInstanceOfSatisfying(
                        TooManyLinksException.class,
                        ex -> assertThat(ex.limit()).isEqualTo(3));
    }

    @Test
    void whatModerationRemovedDoesNotSettleANewcomer() {
        var author = UUID.randomUUID();
        var removed = post(author, elsewhere, "settling in 0");
        backdate(removed, Duration.ofDays(2));
        backdate(post(author, elsewhere, "settling in 1"), Duration.ofDays(2));
        backdate(post(author, elsewhere, "settling in 2"), Duration.ofDays(2));
        commentService.hideByModerator(removed, moderator);

        // two of three left standing: still a newcomer, links and all
        assertThatThrownBy(() -> post(author, here, "https://example.com")).isInstanceOf(LinksNotYetException.class);
    }

    @Test
    void theSameTextIsNeverTakenTwiceInOneDiscussion() {
        var regular = settled();
        backdate(post(regular, here, LONG), Duration.ofDays(2));

        // case and spacing do not make it new
        assertThatThrownBy(() -> post(regular, here, "  " + LONG.toUpperCase() + " "))
                .isInstanceOf(DuplicateCommentException.class);
    }

    @Test
    void elsewhereOnlyForAWhile() {
        var regular = settled();
        var first = post(regular, here, LONG);
        backdate(first, Duration.ofSeconds(6));

        assertThatThrownBy(() -> post(regular, elsewhere, LONG)).isInstanceOf(DuplicateCommentException.class);

        backdate(first, Duration.ofHours(2));
        post(regular, elsewhere, LONG);
    }

    @Test
    void aShortTextComesAgain() {
        var regular = settled();
        backdate(post(regular, here, "Брейк!"), Duration.ofSeconds(6));

        post(regular, here, "Брейк!");
    }

    @Test
    void aReplyIsHeldToItsParentsDiscussion() {
        var regular = settled();
        var parent = post(settled(), here, "top");
        backdate(post(regular, here, LONG), Duration.ofDays(2));

        assertThatThrownBy(() -> commentService.reply(regular, parent, LONG))
                .isInstanceOf(DuplicateCommentException.class);
    }

    @Test
    void anEditIntoATextAlreadyThereIsRefused() {
        var regular = settled();
        backdate(post(regular, here, LONG), Duration.ofDays(2));
        var other = post(regular, here, "something else");

        assertThatThrownBy(() -> commentService.editOwn(regular, other, LONG))
                .isInstanceOf(DuplicateCommentException.class);
    }

    @Test
    void whatHeDeletedHimselfHeMayPostAgain() {
        var regular = settled();
        var deleted = post(regular, here, LONG);
        // the answer keeps the row and its text: a deletion with nothing under it goes from the table
        commentService.reply(settled(), deleted, "answer");
        commentService.deleteOwn(regular, deleted);
        backdate(deleted, Duration.ofSeconds(6));

        post(regular, here, LONG);
    }

    @Test
    void whatModerationRemovedMayNotBeSentAgain() {
        var regular = settled();
        var removed = post(regular, here, LONG);
        commentService.hideByModerator(removed, moderator);

        assertThatThrownBy(() -> post(regular, here, LONG)).isInstanceOf(DuplicateCommentException.class);
    }

    private UUID post(UUID author, UUID subjectId, String body) {
        return commentService
                .create(author, "publication", subjectId, body)
                .comment()
                .id();
    }

    // An author past being a newcomer: three comments that have stood for two days, somewhere else
    private UUID settled() {
        var author = UUID.randomUUID();
        var past = UUID.randomUUID();
        for (var i = 0; i < 3; i++) {
            backdate(post(author, past, "settling in " + i), Duration.ofDays(2));
        }
        return author;
    }

    private void backdate(UUID commentId, Duration ago) {
        jdbc.update(
                "update comment set created_at = ? where id = ?",
                Timestamp.from(Instant.now().minus(ago)),
                commentId);
    }
}
