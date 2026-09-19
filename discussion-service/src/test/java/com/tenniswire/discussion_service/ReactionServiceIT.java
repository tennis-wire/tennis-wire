package com.tenniswire.discussion_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.tenniswire.discussion_service.entity.BlockMode;
import com.tenniswire.discussion_service.exception.CommentDeletedException;
import com.tenniswire.discussion_service.exception.CommentingRestrictedException;
import com.tenniswire.discussion_service.exception.ForbiddenException;
import com.tenniswire.discussion_service.exception.UnknownReactionException;
import com.tenniswire.discussion_service.repository.AuthorReactionTotalRepository;
import com.tenniswire.discussion_service.repository.CommentReactionRepository;
import com.tenniswire.discussion_service.repository.CommentRepository;
import com.tenniswire.discussion_service.service.BlockService;
import com.tenniswire.discussion_service.service.CommentService;
import com.tenniswire.discussion_service.service.ReactionService;
import com.tenniswire.discussion_service.service.RestrictionService;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ReactionServiceIT {

    @Autowired
    private CommentService commentService;

    @Autowired
    private ReactionService reactions;

    @Autowired
    private BlockService blockService;

    @Autowired
    private RestrictionService restrictions;

    @Autowired
    private CommentRepository comments;

    @Autowired
    private CommentReactionRepository rows;

    @Autowired
    private AuthorReactionTotalRepository totals;

    private final UUID subjectId = UUID.randomUUID();
    private final UUID alice = UUID.randomUUID();
    private final UUID bob = UUID.randomUUID();
    private final UUID carol = UUID.randomUUID();
    private final UUID moderator = UUID.randomUUID();

    @Test
    void oneVotePerPersonAndTheLastOneWins() {
        var hers = comment("hers");

        reactions.setVote(bob, hers, "like");
        assertThat(votes(hers)).isEqualTo(new int[] {1, 0});

        reactions.setVote(bob, hers, "dislike");
        assertThat(votes(hers)).isEqualTo(new int[] {0, 1});
        assertThat(rows.findByCommentIdIn(List.of(hers))).hasSize(1);
    }

    @Test
    void theSameVoteAgainChangesNothing() {
        var hers = comment("hers");
        reactions.setVote(bob, hers, "like");

        reactions.setVote(bob, hers, "like");

        assertThat(votes(hers)).isEqualTo(new int[] {1, 0});
    }

    @Test
    void twoPeopleAreCountedApart() {
        var hers = comment("hers");

        reactions.setVote(bob, hers, "like");
        reactions.setVote(carol, hers, "like");

        assertThat(votes(hers)).isEqualTo(new int[] {2, 0});
    }

    @Test
    void takingBackTakesTheCountDown() {
        var hers = comment("hers");
        reactions.setVote(bob, hers, "like");

        reactions.clearVote(bob, hers);

        assertThat(votes(hers)).isEqualTo(new int[] {0, 0});
        assertThat(rows.findByCommentIdIn(List.of(hers))).isEmpty();
    }

    @Test
    void takingBackWhatWasNeverThereIsNotAnError() {
        var hers = comment("hers");

        reactions.clearVote(bob, hers);

        assertThat(votes(hers)).isEqualTo(new int[] {0, 0});
    }

    @Test
    void theEmojiSlotIsIndependentOfTheVote() {
        var hers = comment("hers");

        reactions.setVote(bob, hers, "like");
        reactions.setEmoji(bob, hers, "clown");

        assertThat(votes(hers)).isEqualTo(new int[] {1, 0});
        assertThat(emoji(hers)).isEqualTo(Map.of("clown", 1));
        assertThat(rows.findByCommentIdIn(List.of(hers))).hasSize(2);
    }

    @Test
    void aNewEmojiReplacesTheOldOneAndTheKeyGoesWithTheLastOfIt() {
        var hers = comment("hers");
        reactions.setEmoji(bob, hers, "clown");

        reactions.setEmoji(bob, hers, "laugh");

        assertThat(emoji(hers)).isEqualTo(Map.of("laugh", 1));
    }

    @Test
    void anEmojiOutsideTheConfiguredSetIsRefused() {
        var hers = comment("hers");

        assertThatThrownBy(() -> reactions.setEmoji(bob, hers, "rocket")).isInstanceOf(UnknownReactionException.class);
        assertThatThrownBy(() -> reactions.setVote(bob, hers, "meh")).isInstanceOf(UnknownReactionException.class);
    }

    @Test
    void notOnOnesOwnComment() {
        var hers = comment("hers");

        assertThatThrownBy(() -> reactions.setVote(alice, hers, "like")).isInstanceOf(ForbiddenException.class);
    }

    @Test
    void notOnAPlaceholder() {
        var hers = comment("hers");
        commentService.reply(bob, hers, "keeps the node");
        commentService.deleteOwn(alice, hers);

        assertThatThrownBy(() -> reactions.setVote(bob, hers, "like")).isInstanceOf(CommentDeletedException.class);
    }

    @Test
    void underABanHeMayTakeBackButNotGive() {
        var hers = comment("hers");
        reactions.setVote(bob, hers, "like");
        restrictions.restrictCommenting(bob, moderator, Instant.now().plus(Duration.ofHours(1)), "flood");

        assertThatThrownBy(() -> reactions.setVote(bob, hers, "dislike"))
                .isInstanceOf(CommentingRestrictedException.class);
        reactions.clearVote(bob, hers);

        assertThat(votes(hers)).isEqualTo(new int[] {0, 0});
    }

    @Test
    void anIgnoredAuthorIsOutOfReachInTheTwoStrongerModes() {
        var hers = comment("hers");
        blockService.block(bob, alice, BlockMode.GRAVESTONE);
        blockService.block(carol, alice, BlockMode.SUBTREE_REMOVAL);

        assertThatThrownBy(() -> reactions.setVote(bob, hers, "like")).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> reactions.setVote(carol, hers, "like")).isInstanceOf(ForbiddenException.class);
    }

    @Test
    void collapsingLeavesHimInReach() {
        var hers = comment("hers");
        blockService.block(bob, alice, BlockMode.SOFT);

        reactions.setVote(bob, hers, "like");

        assertThat(votes(hers)).isEqualTo(new int[] {1, 0});
    }

    @Test
    void aRemovalSweepsTheCountsIntoTheAuthorsTotal() {
        var hers = comment("hers");
        reactions.setVote(bob, hers, "like");
        reactions.setVote(carol, hers, "dislike");
        reactions.setEmoji(bob, hers, "vomit");
        commentService.reply(bob, hers, "keeps the node");

        commentService.deleteOwn(alice, hers);

        var total = totals.findById(alice).orElseThrow();
        assertThat(total.likeCount()).isEqualTo(1);
        assertThat(total.dislikeCount()).isEqualTo(1);
        assertThat(total.emojiCounts()).isEqualTo(Map.of("vomit", 1L));
        // zeroed on the comment, so that a second pass over the same row adds nothing
        assertThat(votes(hers)).isEqualTo(new int[] {0, 0});
        assertThat(rows.findByCommentIdIn(List.of(hers))).isEmpty();
    }

    @Test
    void whatOneAuthorCollectsOnTwoCommentsAddsUp() {
        var one = comment("one");
        var two = comment("two");
        reactions.setVote(bob, one, "like");
        reactions.setVote(bob, two, "like");
        commentService.reply(bob, one, "keeps the node");
        commentService.reply(bob, two, "keeps the node");

        commentService.deleteOwn(alice, one);
        commentService.deleteOwn(alice, two);

        assertThat(totals.findById(alice).orElseThrow().likeCount()).isEqualTo(2);
    }

    @Test
    void takingEverythingOnePersonGaveComesOffTheCounts() {
        var one = comment("one");
        var two = comment("two");
        reactions.setVote(bob, one, "like");
        reactions.setEmoji(bob, two, "laugh");
        reactions.setVote(carol, one, "like");

        reactions.clearAllBy(bob);

        assertThat(votes(one)).isEqualTo(new int[] {1, 0});
        assertThat(emoji(two)).isEmpty();
        assertThat(rows.findByUser(bob)).isEmpty();
    }

    @Test
    void aViewerGetsBackWhatHePutAndNothingOfAnyoneElses() {
        var one = comment("one");
        var two = comment("two");
        reactions.setVote(bob, one, "like");
        reactions.setEmoji(bob, one, "laugh");
        reactions.setVote(carol, two, "dislike");

        var his = reactions.of(bob, List.of(one, two));

        assertThat(his).containsOnlyKeys(one);
        assertThat(his.get(one).vote()).isEqualTo("like");
        assertThat(his.get(one).emoji()).isEqualTo("laugh");
    }

    @Test
    void aReaderWhoIsNotSignedInHasNothingOfHisOwn() {
        var hers = comment("hers");
        reactions.setVote(bob, hers, "like");

        assertThat(reactions.of(null, List.of(hers))).isEmpty();
    }

    @Test
    void anIndefiniteBanCanTakeBackEverythingHePut() {
        var one = comment("one");
        var two = comment("two");
        reactions.setVote(bob, one, "like");
        reactions.setEmoji(bob, two, "clown");
        reactions.setVote(carol, one, "like");

        restrictions.restrictCommenting(bob, moderator, null, "done with him", true);

        assertThat(votes(one)).isEqualTo(new int[] {1, 0});
        assertThat(emoji(two)).isEmpty();
        assertThat(rows.findByUser(bob)).isEmpty();
    }

    @Test
    void anIndefiniteBanLeavesThemAloneUnlessAsked() {
        var hers = comment("hers");
        reactions.setVote(bob, hers, "like");

        restrictions.restrictCommenting(bob, moderator, null, "quiet for now");

        assertThat(votes(hers)).isEqualTo(new int[] {1, 0});
    }

    @Test
    void aTemporaryBanMayNotTakeThemBack() {
        var hers = comment("hers");
        reactions.setVote(bob, hers, "like");

        assertThatThrownBy(() -> restrictions.restrictCommenting(
                        bob, moderator, Instant.now().plus(Duration.ofHours(1)), "flood", true))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(votes(hers)).isEqualTo(new int[] {1, 0});
    }

    private UUID comment(String body) {
        return commentService
                .create(alice, "publication", subjectId, body)
                .comment()
                .id();
    }

    private int[] votes(UUID commentId) {
        var comment = comments.findById(commentId).orElseThrow();
        return new int[] {comment.likeCount(), comment.dislikeCount()};
    }

    private Map<String, Integer> emoji(UUID commentId) {
        return comments.findById(commentId).orElseThrow().emojiCounts();
    }
}
