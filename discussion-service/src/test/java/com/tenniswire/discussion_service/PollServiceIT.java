package com.tenniswire.discussion_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.tenniswire.discussion_service.dto.poll.CreatePollRequest;
import com.tenniswire.discussion_service.dto.poll.PollResponse;
import com.tenniswire.discussion_service.dto.poll.UpdatePollRequest;
import com.tenniswire.discussion_service.entity.PollVote;
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
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
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
        return polls.create(author, new CreatePollRequest("Who wins?", List.of("Sinner", "Alcaraz"), closesAt, null));
    }

    private PollResponse multiPoll() {
        return polls.create(
                author,
                new CreatePollRequest("Who makes the semis?", List.of("Sinner", "Alcaraz", "Djokovic"), null, true));
    }

    private void choose(UUID who, PollResponse poll, int... positions) {
        polls.vote(who, poll.id(), ids(poll, positions));
    }

    private static List<UUID> ids(PollResponse poll, int... positions) {
        return Arrays.stream(positions)
                .mapToObj(i -> poll.options().get(i).id())
                .toList();
    }

    // Each option's count in order, then the poll's
    private static int[] counts(PollResponse poll) {
        return IntStream.concat(
                        poll.options().stream().mapToInt(PollResponse.Option::voteCount),
                        IntStream.of(poll.voteCount()))
                .toArray();
    }

    @Test
    void optionsKeepTheOrderTheyWereWrittenIn() {
        var made = poll(null);

        var read = polls.get(made.id(), null);

        assertThat(read.options()).extracting(PollResponse.Option::text).containsExactly("Sinner", "Alcaraz");
        assertThat(read.closed()).isFalse();
        assertThat(read.multipleChoice()).isFalse();
        assertThat(read.viewerOptionIds()).isEmpty();
    }

    @Test
    void oneVotePerPersonAndTheLastOneWins() {
        var made = poll(null);
        var sinner = made.options().get(0).id();
        var alcaraz = made.options().get(1).id();

        polls.vote(bob, made.id(), List.of(sinner));
        assertThat(counts(polls.get(made.id(), null))).isEqualTo(new int[] {1, 0, 1});

        polls.vote(bob, made.id(), List.of(alcaraz));
        assertThat(counts(polls.get(made.id(), null))).isEqualTo(new int[] {0, 1, 1});

        polls.vote(bob, made.id(), List.of(alcaraz));
        assertThat(counts(polls.get(made.id(), null))).isEqualTo(new int[] {0, 1, 1});
        assertThat(polls.get(made.id(), bob).viewerOptionIds()).containsExactly(alcaraz);
        assertThat(polls.get(made.id(), carol).viewerOptionIds()).isEmpty();
        assertThat(votes.findChoice(made.id(), bob))
                .extracting(PollVote::optionId)
                .containsExactly(alcaraz);
    }

    @Test
    void aVoteCanBeTakenBack() {
        var made = poll(null);
        choose(bob, made, 0);
        choose(carol, made, 0);

        polls.retract(bob, made.id());
        polls.retract(bob, made.id());

        assertThat(counts(polls.get(made.id(), null))).isEqualTo(new int[] {1, 0, 1});
        assertThat(polls.get(made.id(), bob).viewerOptionIds()).isEmpty();
    }

    @Test
    void anOptionOfAnotherPollIsNotAChoiceHere() {
        var made = poll(null);
        var other = poll(null);

        assertThatThrownBy(() -> polls.vote(bob, made.id(), ids(other, 0)))
                .isInstanceOf(ResourceNotFoundException.class);
        assertThat(counts(polls.get(made.id(), null))).isEqualTo(new int[] {0, 0, 0});
    }

    @Test
    void aClosedPollTakesNoVoteAndGivesNoneBack() {
        var made = poll(null);
        var sinner = made.options().get(0).id();
        polls.vote(bob, made.id(), List.of(sinner));

        polls.close(made.id(), byAuthor, Instant.now().minus(Duration.ofMinutes(1)));

        assertThat(polls.get(made.id(), null).closed()).isTrue();
        assertThatThrownBy(() -> polls.vote(carol, made.id(), List.of(sinner))).isInstanceOf(PollClosedException.class);
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
        polls.vote(bob, made.id(), List.of(sinner));

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
        choose(bob, made, 0);
        restrictions.restrictCommenting(bob, carol, Instant.now().plus(Duration.ofHours(1)), "flood");

        assertThatThrownBy(() -> choose(bob, made, 1)).isInstanceOf(CommentingRestrictedException.class);
        polls.retract(bob, made.id());

        assertThat(counts(polls.get(made.id(), null))).isEqualTo(new int[] {0, 0, 0});
    }

    @Test
    void anErasedReaderTakesHisVotesWithHim() {
        var open = poll(null);
        var closed = poll(null);
        choose(bob, open, 0);
        choose(bob, closed, 1);
        choose(carol, open, 0);
        polls.close(closed.id(), byAuthor, Instant.now().minus(Duration.ofMinutes(1)));

        erasure.erase(bob);

        assertThat(counts(polls.get(open.id(), null))).isEqualTo(new int[] {1, 0, 1});
        assertThat(counts(polls.get(closed.id(), null))).isEqualTo(new int[] {0, 0, 0});
        assertThat(votes.findByUser(bob)).isEmpty();
        assertThat(votes.findByUser(carol)).hasSize(1);
    }

    @Test
    void aSingleChoicePollTakesOneOptionAtATime() {
        var made = poll(null);
        var sinner = made.options().get(0).id();

        assertThatThrownBy(() -> choose(bob, made, 0, 1)).isInstanceOf(IllegalArgumentException.class);
        assertThat(counts(polls.get(made.id(), null))).isEqualTo(new int[] {0, 0, 0});

        // the same option twice is still one
        polls.vote(bob, made.id(), List.of(sinner, sinner));
        assertThat(counts(polls.get(made.id(), null))).isEqualTo(new int[] {1, 0, 1});
    }

    @Test
    void aPersonCountsOnceHoweverManyOptionsHeChooses() {
        var made = multiPoll();

        choose(bob, made, 0, 1);
        choose(carol, made, 1);

        var read = polls.get(made.id(), bob);
        assertThat(read.multipleChoice()).isTrue();
        assertThat(counts(read)).isEqualTo(new int[] {1, 2, 0, 2});
        assertThat(read.viewerOptionIds()).containsExactlyElementsOf(ids(made, 0, 1));
    }

    @Test
    void aNewChoiceMovesOnlyWhatChanged() {
        var made = multiPoll();
        choose(bob, made, 0, 1);
        choose(carol, made, 1);

        choose(bob, made, 1, 2);
        assertThat(counts(polls.get(made.id(), null))).isEqualTo(new int[] {0, 2, 1, 2});

        // the same choice in another order, with a repeat, changes nothing
        choose(bob, made, 2, 1, 2);
        var read = polls.get(made.id(), bob);
        assertThat(counts(read)).isEqualTo(new int[] {0, 2, 1, 2});
        assertThat(read.viewerOptionIds()).containsExactlyElementsOf(ids(made, 1, 2));
        assertThat(votes.findChoice(made.id(), bob)).hasSize(2);
    }

    @Test
    void anOptionOfAnotherPollSpoilsTheWholeChoice() {
        var made = multiPoll();
        var other = multiPoll();
        choose(bob, made, 0);

        var mixed = List.of(made.options().get(1).id(), other.options().get(0).id());
        assertThatThrownBy(() -> polls.vote(bob, made.id(), mixed)).isInstanceOf(ResourceNotFoundException.class);

        assertThat(counts(polls.get(made.id(), null))).isEqualTo(new int[] {1, 0, 0, 1});
        assertThat(polls.get(made.id(), bob).viewerOptionIds()).containsExactlyElementsOf(ids(made, 0));
    }

    @Test
    void takingBackAMultipleChoiceTakesAllOfIt() {
        var made = multiPoll();
        choose(bob, made, 0, 2);
        choose(carol, made, 0);

        polls.retract(bob, made.id());

        assertThat(counts(polls.get(made.id(), null))).isEqualTo(new int[] {1, 0, 0, 1});
        assertThat(polls.get(made.id(), bob).viewerOptionIds()).isEmpty();
    }

    @Test
    void anErasedReaderTakesHisWholeChoiceWithHim() {
        var made = multiPoll();
        choose(bob, made, 0, 1, 2);
        choose(carol, made, 1);

        erasure.erase(bob);

        assertThat(counts(polls.get(made.id(), null))).isEqualTo(new int[] {0, 1, 0, 1});
        assertThat(votes.findByUser(bob)).isEmpty();
    }
}
