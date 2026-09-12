package com.tenniswire.discussion_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.tenniswire.discussion_service.client.AuthorProfile;
import com.tenniswire.discussion_service.client.AuthorProfileClient;
import com.tenniswire.discussion_service.controller.moderation.ModerationQueueResponses;
import com.tenniswire.discussion_service.dto.moderation.QueueEntryResponse;
import com.tenniswire.discussion_service.entity.Comment;
import com.tenniswire.discussion_service.entity.Report;
import com.tenniswire.discussion_service.entity.ReportResolution;
import com.tenniswire.discussion_service.exception.ResolutionNotApplicableException;
import com.tenniswire.discussion_service.exception.UserServiceUnavailableException;
import com.tenniswire.discussion_service.repository.CommentRepository;
import com.tenniswire.discussion_service.repository.ReportRepository;
import com.tenniswire.discussion_service.service.CommentService;
import com.tenniswire.discussion_service.service.ModerationQueueService;
import com.tenniswire.discussion_service.service.QueuedComment;
import com.tenniswire.discussion_service.service.ReportService;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ModerationQueueIT {

    @MockitoBean
    private AuthorProfileClient profiles;

    @Autowired
    private ModerationQueueService queue;

    @Autowired
    private ModerationQueueResponses queueResponses;

    @Autowired
    private ReportService reportService;

    @Autowired
    private CommentService commentService;

    @Autowired
    private RestrictionService restrictionService;

    @Autowired
    private CommentRepository comments;

    @Autowired
    private ReportRepository reports;

    private final UUID subjectId = UUID.randomUUID();
    private final UUID author = UUID.randomUUID();
    private final UUID moderator = UUID.randomUUID();

    @Test
    void cardsAreGroupedByCommentAndOrderedByWeight() {
        var light = comment();
        var heavy = comment();
        reportService.report(UUID.randomUUID(), light, "spam");
        reportService.report(UUID.randomUUID(), heavy, "spam");
        reportService.report(UUID.randomUUID(), heavy, "insult");
        reportService.report(UUID.randomUUID(), heavy, "insult");

        var page = mine(queue.open(0, 200), light, heavy);

        assertThat(page).extracting(q -> q.comment().id()).containsExactly(heavy, light);
        var card = page.getFirst();
        assertThat(card.reportCount()).isEqualTo(3);
        assertThat(card.reasons()).isEqualTo(Map.of("spam", 1L, "insult", 2L));
        assertThat(card.fromBot()).isFalse();
        assertThat(card.firstReportedAt()).isBeforeOrEqualTo(card.lastReportedAt());
    }

    @Test
    void aBotReportIsMarkedAsOne() {
        var comment = comment();
        reportService.report(UUID.randomUUID(), comment, "spam");
        reports.saveAndFlush(
                new Report().commentId(comment).source(Report.SOURCE_BOT).reason("hate"));

        var card = mine(queue.open(0, 200), comment).getFirst();

        assertThat(card.reportCount()).isEqualTo(2);
        assertThat(card.fromBot()).isTrue();
    }

    @Test
    void removingTheCommentClosesTheCardAndForgetsWhoReportedIt() {
        var comment = comment();
        reportService.report(UUID.randomUUID(), comment, "spam");

        queue.resolve(comment, ReportResolution.HIDDEN, moderator);

        assertThat(mine(queue.open(0, 200), comment)).isEmpty();
        assertThat(reportsOn(comment)).allSatisfy(r -> {
            assertThat(r.resolution()).isEqualTo(ReportResolution.HIDDEN);
            assertThat(r.resolvedBy()).isEqualTo(moderator);
            assertThat(r.reporterHash()).isNull();
        });
        var stored = comments.findById(comment).orElseThrow();
        assertThat(stored.hiddenSource()).isEqualTo(Comment.HIDDEN_BY_MODERATOR);
        assertThat(stored.hiddenBy()).isEqualTo(moderator);
    }

    @Test
    void takingACommentDownFromTheCommentEndpointClosesItsCardToo() {
        var comment = comment();
        reportService.report(UUID.randomUUID(), comment, "spam");

        commentService.hideByModerator(comment, moderator);

        assertThat(mine(queue.open(0, 200), comment)).isEmpty();
    }

    @Test
    void aBotRemovalIsRecordedUnsigned() {
        var comment = comment();

        commentService.hideByBot(comment);

        var stored = comments.findById(comment).orElseThrow();
        assertThat(stored.hiddenSource()).isEqualTo(Comment.HIDDEN_BY_BOT);
        assertThat(stored.hiddenBy()).isNull();
    }

    @Test
    void aCommentLeftStandingComesBackOnlyAfterAnEdit() {
        var comment = comment();
        var reader = UUID.randomUUID();
        reportService.report(reader, comment, "spam");

        queue.resolve(comment, ReportResolution.DISMISSED, moderator);
        assertThat(mine(queue.open(0, 200), comment)).isEmpty();
        assertThat(comments.findById(comment).orElseThrow().reportsClosedAt()).isNotNull();

        // Accepted and dropped: the reader is told nothing, and the card does not reopen.
        reportService.report(UUID.randomUUID(), comment, "insult");
        assertThat(mine(queue.open(0, 200), comment)).isEmpty();

        comments.saveAndFlush(comments.findById(comment).orElseThrow().body("edited"));

        reportService.report(reader, comment, "spam");
        assertThat(mine(queue.open(0, 200), comment)).hasSize(1);
    }

    @Test
    void aViolationIsCountedByHandOnlyOnACommentItsAuthorDeleted() {
        var live = comment();
        reportService.report(UUID.randomUUID(), live, "spam");

        assertThatThrownBy(() -> queue.resolve(live, ReportResolution.COUNTED, moderator))
                .isInstanceOf(ResolutionNotApplicableException.class);

        commentService.deleteOwn(author, live);
        queue.resolve(live, ReportResolution.COUNTED, moderator);

        assertThat(mine(queue.open(0, 200), live)).isEmpty();
        assertThat(reportsOn(live)).allSatisfy(r -> assertThat(r.resolution()).isEqualTo(ReportResolution.COUNTED));

        // Counted by hand lands in the same total as a removal, though nothing was removed here.
        var counts = countsFor(author);
        assertThat(counts.removedByModerator().total()).isEqualTo(1);
        assertThat(counts.removedByModerator().last30Days()).isEqualTo(1);
        assertThat(counts.removedByBot().total()).isZero();
    }

    private QueueEntryResponse.QueueAuthor countsFor(UUID authorId) {
        var carrier = comment();
        reportService.report(UUID.randomUUID(), carrier, "spam");
        when(profiles.profiles(any())).thenReturn(Map.of(authorId, new AuthorProfile(authorId, "counted-one", null)));
        return queueResponses
                .of(mine(queue.open(0, 200), carrier), 0, 200)
                .items()
                .getFirst()
                .author();
    }

    @Test
    void moderationCannotRemoveWhatTheAuthorTookDownHimself() {
        var comment = comment();
        commentService.deleteOwn(author, comment);

        assertThatThrownBy(() -> commentService.hideByModerator(comment, moderator))
                .isInstanceOf(ResolutionNotApplicableException.class);
    }

    @Test
    void aCardCarriesTheAuthorsNameEvenWhileHeIsBanned() {
        var comment = comment();
        // The author's record, written while he could still write: the ban below stops him.
        commentService.hideByBot(comment());
        reportService.report(UUID.randomUUID(), comment, "spam");
        restrictionService.restrictCommenting(author, moderator, Instant.now().plus(Duration.ofHours(2)), "flood");
        when(profiles.profiles(any())).thenReturn(Map.of(author, new AuthorProfile(author, "loud-one", null)));

        var entry = queueResponses
                .of(mine(queue.open(0, 200), comment), 0, 200)
                .items()
                .getFirst();

        assertThat(entry.author().displayName()).isEqualTo("loud-one");
        assertThat(entry.author().restriction()).isNotNull();
        assertThat(entry.author().restriction().expiresAt()).isNotNull();
        assertThat(entry.author().removedByBot().total()).isEqualTo(1);
        assertThat(entry.author().removedByBot().last30Days()).isEqualTo(1);
        assertThat(entry.author().removedByModerator().total()).isZero();
    }

    @Test
    void anUnreachableUserServiceCostsTheNamesAndNotTheQueue() {
        var comment = comment();
        reportService.report(UUID.randomUUID(), comment, "spam");
        when(profiles.profiles(any())).thenThrow(new UserServiceUnavailableException("down"));

        var entry = queueResponses
                .of(mine(queue.open(0, 200), comment), 0, 200)
                .items()
                .getFirst();

        assertThat(entry.author().id()).isEqualTo(author);
        assertThat(entry.author().displayName()).isNull();
        assertThat(entry.body()).isNotBlank();
    }

    private UUID comment() {
        return commentService
                .create(author, "article", subjectId, "reported")
                .comment()
                .id();
    }

    private List<Report> reportsOn(UUID commentId) {
        return reports.findAll().stream()
                .filter(r -> r.commentId().equals(commentId))
                .toList();
    }

    private static List<QueuedComment> mine(List<QueuedComment> page, UUID... ids) {
        var wanted = List.of(ids);
        return page.stream().filter(q -> wanted.contains(q.comment().id())).toList();
    }
}
