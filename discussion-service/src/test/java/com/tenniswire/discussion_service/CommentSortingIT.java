package com.tenniswire.discussion_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.tenniswire.discussion_service.exception.InvalidCursorException;
import com.tenniswire.discussion_service.exception.UnknownSortException;
import com.tenniswire.discussion_service.service.CommentService;
import com.tenniswire.discussion_service.service.CommentSort;
import com.tenniswire.discussion_service.service.ReactionService;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class CommentSortingIT {

    @Autowired
    private CommentService commentService;

    @Autowired
    private ReactionService reactions;

    private final UUID subjectId = UUID.randomUUID();
    private final UUID alice = UUID.randomUUID();
    private final UUID bob = UUID.randomUUID();
    private final UUID carol = UUID.randomUUID();

    private UUID first;
    private UUID second;
    private UUID third;

    @BeforeEach
    void threeComments() {
        // Written in this order, so oldest first is first, second, third
        first = comment("first");
        second = comment("second");
        third = comment("third");

        // first ends on -1, second on 0, third on +2
        reactions.setVote(bob, first, "dislike");
        reactions.setVote(bob, third, "like");
        reactions.setVote(carol, third, "like");
    }

    @Test
    void oldestFirstIsTheOrderTheyWereWrittenIn() {
        assertThat(listed(CommentSort.OLDEST)).containsExactly(first, second, third);
    }

    @Test
    void newestFirstTurnsThatAround() {
        assertThat(listed(CommentSort.NEWEST)).containsExactly(third, second, first);
    }

    @Test
    void topIsByScoreAndNotByLikesAlone() {
        assertThat(listed(CommentSort.TOP)).containsExactly(third, second, first);
    }

    @Test
    void bottomIsTheSameKeyReadTheOtherWay() {
        assertThat(listed(CommentSort.BOTTOM)).containsExactly(first, second, third);
    }

    @Test
    void aTieIsBrokenTheWayTheSortRuns() {
        // second and a fourth both sit on zero; under TOP the newer of the two comes first
        var fourth = comment("fourth");

        assertThat(listed(CommentSort.TOP)).containsExactly(third, fourth, second, first);
        assertThat(listed(CommentSort.BOTTOM)).containsExactly(first, second, fourth, third);
    }

    @Test
    void repliesInsideABranchStayOldestFirstWhateverTheListingIsSortedBy() {
        var early = commentService.reply(bob, third, "early").comment().id();
        var late = commentService.reply(bob, third, "late").comment().id();
        reactions.setVote(carol, late, "like");

        var branch = commentService.branch(third, null);

        assertThat(branch.replies().stream().map(view -> view.comment().id())).containsExactly(early, late);
    }

    @Test
    void pagingByScoreHandsOutEachCommentOnce() {
        var seen = new ArrayList<UUID>();
        String cursor = null;
        do {
            var page = commentService.listTopLevel("publication", subjectId, null, 1, cursor, CommentSort.TOP);
            page.items().forEach(view -> seen.add(view.comment().id()));
            cursor = page.nextCursor();
        } while (cursor != null);

        assertThat(seen).containsExactly(third, second, first);
    }

    @Test
    void aCursorCutForOneOrderIsRefusedByAnother() {
        var page = commentService.listTopLevel("publication", subjectId, null, 1, null, CommentSort.TOP);

        assertThatThrownBy(() -> commentService.listTopLevel(
                        "publication", subjectId, null, 1, page.nextCursor(), CommentSort.NEWEST))
                .isInstanceOf(InvalidCursorException.class);
    }

    @Test
    void anUnknownSortIsRefusedAndAnEmptyOneIsTheDefault() {
        assertThatThrownBy(() -> CommentSort.fromValue("loudest")).isInstanceOf(UnknownSortException.class);
        assertThat(CommentSort.fromValue(null)).isEqualTo(CommentSort.NEWEST);
        assertThat(CommentSort.fromValue("")).isEqualTo(CommentSort.NEWEST);
    }

    private List<UUID> listed(CommentSort sort) {
        return commentService.listTopLevel("publication", subjectId, null, null, null, sort).items().stream()
                .map(view -> view.comment().id())
                .toList();
    }

    private UUID comment(String body) {
        return commentService
                .create(alice, "publication", subjectId, body)
                .comment()
                .id();
    }
}
