package com.tenniswire.discussion_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.tenniswire.discussion_service.dto.poll.CreatePollRequest;
import com.tenniswire.discussion_service.dto.poll.PollResponse;
import com.tenniswire.discussion_service.dto.poll.UpdatePollRequest;
import com.tenniswire.discussion_service.exception.CommentingRestrictedException;
import com.tenniswire.discussion_service.exception.ForbiddenException;
import com.tenniswire.discussion_service.exception.PollClosedException;
import com.tenniswire.discussion_service.exception.ResourceNotFoundException;
import com.tenniswire.discussion_service.repository.PollVoteRepository;
import com.tenniswire.discussion_service.service.PollEditor;
import com.tenniswire.discussion_service.service.PollService;
import com.tenniswire.discussion_service.service.ReaderErasure;
import com.tenniswire.discussion_service.service.RestrictionService;
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
class PollServiceIT {

    @Autowired
    private PollService polls;

    @Autowired
    private PollVoteRepository votes;

    @Autowired
    private ReaderErasure erasure;

    @Autowired
    private RestrictionService restrictions;

    private final UUID author = UUID.randomUUID();
    private final UUID bob = UUID.randomUUID();
    private final UUID carol = UUID.randomUUID();
    private final PollEditor byAuthor = new PollEditor(author, false);

    private PollResponse poll(Instant closesAt) {
        return polls.create(author, new CreatePollRequest("Who wins?", List.of("Sinner", "Alcaraz"), closesAt));
    }

    private static int[] counts(PollResponse poll) {
        return new int[] {
            poll.options().get(0).voteCount(), poll.options().get(1).voteCount(), poll.voteCount()
        };
    }

    @Test
    void optionsKeepTheOrderTheyWereWrittenIn() {
        var made = poll(null);

        var read = polls.get(made.id(), null);

        assertThat(read.options()).extracting(PollResponse.Option::text).containsExactly("Sinner", "Alcaraz");
        assertThat(read.closed()).isFalse();
        assertThat(read.viewerOptionId()).isNull();
    }

    @Test
    void oneVotePerPersonAndTheLastOneWins() {
        var made = poll(null);
        var sinner = made.options().get(0).id();
        var alcaraz = made.options().get(1).id();

        polls.vote(bob, made.id(), sinner);
        assertThat(counts(polls.get(made.id(), null))).isEqualTo(new int[] {1, 0, 1});

        polls.vote(bob, made.id(), alcaraz);
        assertThat(counts(polls.get(made.id(), null))).isEqualTo(new int[] {0, 1, 1});

        polls.vote(bob, made.id(), alcaraz);
        assertThat(counts(polls.get(made.id(), null))).isEqualTo(new int[] {0, 1, 1});
        assertThat(polls.get(made.id(), bob).viewerOptionId()).isEqualTo(alcaraz);
        assertThat(polls.get(made.id(), carol).viewerOptionId()).isNull();
    }

    @Test
    void aVoteCanBeTakenBack() {
        var made = poll(null);
        polls.vote(bob, made.id(), made.options().get(0).id());
        polls.vote(carol, made.id(), made.options().get(0).id());

        polls.retract(bob, made.id());
        polls.retract(bob, made.id());

        assertThat(counts(polls.get(made.id(), null))).isEqualTo(new int[] {1, 0, 1});
        assertThat(polls.get(made.id(), bob).viewerOptionId()).isNull();
    }

    @Test
    void anOptionOfAnotherPollIsNotAChoiceHere() {
        var made = poll(null);
        var other = poll(null);

        assertThatThrownBy(
                        () -> polls.vote(bob, made.id(), other.options().get(0).id()))
                .isInstanceOf(ResourceNotFoundException.class);
        assertThat(counts(polls.get(made.id(), null))).isEqualTo(new int[] {0, 0, 0});
    }

    @Test
    void aClosedPollTakesNoVoteAndGivesNoneBack() {
        var made = poll(null);
        var sinner = made.options().get(0).id();
        polls.vote(bob, made.id(), sinner);

        polls.close(made.id(), byAuthor, Instant.now().minus(Duration.ofMinutes(1)));

        assertThat(polls.get(made.id(), null).closed()).isTrue();
        assertThatThrownBy(() -> polls.vote(carol, made.id(), sinner)).isInstanceOf(PollClosedException.class);
        assertThatThrownBy(() -> polls.retract(bob, made.id())).isInstanceOf(PollClosedException.class);
        assertThat(counts(polls.get(made.id(), null))).isEqualTo(new int[] {1, 0, 1});

        // and a poll closed for a time in the future is still open
        polls.close(made.id(), byAuthor, Instant.now().plus(Duration.ofDays(1)));
        assertThat(polls.get(made.id(), null).closed()).isFalse();
        polls.close(made.id(), byAuthor, null);
        assertThat(polls.get(made.id(), null).closesAt()).isNull();
    }

    @Test
    void wordingChangesUnderTheVotes() {
        var made = poll(null);
        var sinner = made.options().get(0).id();
        polls.vote(bob, made.id(), sinner);

        var edited = polls.update(
                made.id(),
                byAuthor,
                new UpdatePollRequest(
                        "Who takes the title?", List.of(new UpdatePollRequest.OptionText(sinner, "J. Sinner"))));

        assertThat(edited.question()).isEqualTo("Who takes the title?");
        assertThat(edited.options().get(0).text()).isEqualTo("J. Sinner");
        assertThat(edited.options().get(1).text()).isEqualTo("Alcaraz");
        assertThat(counts(edited)).isEqualTo(new int[] {1, 0, 1});
        assertThatThrownBy(() -> polls.update(
                        made.id(),
                        byAuthor,
                        new UpdatePollRequest(null, List.of(new UpdatePollRequest.OptionText(UUID.randomUUID(), "x")))))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void onlyItsAuthorOrAChiefEditorChangesAPoll() {
        var made = poll(null);
        var anotherAuthor = new PollEditor(UUID.randomUUID(), false);

        assertThatThrownBy(() -> polls.close(made.id(), anotherAuthor, null)).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> polls.update(made.id(), anotherAuthor, new UpdatePollRequest("Mine now?", null)))
                .isInstanceOf(ForbiddenException.class);

        var chiefEditor = new PollEditor(UUID.randomUUID(), true);
        assertThat(polls.update(made.id(), chiefEditor, new UpdatePollRequest("Who takes it?", null))
                        .question())
                .isEqualTo("Who takes it?");
    }

    @Test
    void aBanStopsAVoteButNotItsRetraction() {
        var made = poll(null);
        polls.vote(bob, made.id(), made.options().get(0).id());
        restrictions.restrictCommenting(bob, carol, Instant.now().plus(Duration.ofHours(1)), "flood");

        assertThatThrownBy(
                        () -> polls.vote(bob, made.id(), made.options().get(1).id()))
                .isInstanceOf(CommentingRestrictedException.class);
        polls.retract(bob, made.id());

        assertThat(counts(polls.get(made.id(), null))).isEqualTo(new int[] {0, 0, 0});
    }

    @Test
    void anErasedReaderTakesHisVotesWithHim() {
        var open = poll(null);
        var closed = poll(null);
        polls.vote(bob, open.id(), open.options().get(0).id());
        polls.vote(bob, closed.id(), closed.options().get(1).id());
        polls.vote(carol, open.id(), open.options().get(0).id());
        polls.close(closed.id(), byAuthor, Instant.now().minus(Duration.ofMinutes(1)));

        erasure.erase(bob);

        assertThat(counts(polls.get(open.id(), null))).isEqualTo(new int[] {1, 0, 1});
        assertThat(counts(polls.get(closed.id(), null))).isEqualTo(new int[] {0, 0, 0});
        assertThat(votes.findByUser(bob)).isEmpty();
        assertThat(votes.findByUser(carol)).hasSize(1);
    }
}
