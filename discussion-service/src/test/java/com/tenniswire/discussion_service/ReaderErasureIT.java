package com.tenniswire.discussion_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import com.tenniswire.discussion_service.entity.BlockMode;
import com.tenniswire.discussion_service.entity.ReportResolution;
import com.tenniswire.discussion_service.entity.UserRestriction;
import com.tenniswire.discussion_service.repository.CommentRepository;
import com.tenniswire.discussion_service.repository.ReportRepository;
import com.tenniswire.discussion_service.repository.UserRestrictionRepository;
import com.tenniswire.discussion_service.service.BlockService;
import com.tenniswire.discussion_service.service.CommentService;
import com.tenniswire.discussion_service.service.ReaderErasure;
import com.tenniswire.discussion_service.service.ReportService;
import com.tenniswire.discussion_service.service.RestrictionService;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ReaderErasureIT {

    @Autowired
    private ReaderErasure erasure;

    @Autowired
    private CommentService commentService;

    @Autowired
    private BlockService blockService;

    @Autowired
    private ReportService reportService;

    @Autowired
    private RestrictionService restrictionService;

    @Autowired
    private CommentRepository comments;

    @Autowired
    private ReportRepository reports;

    @Autowired
    private UserRestrictionRepository restrictions;

    private final UUID subjectId = UUID.randomUUID();
    private final UUID alice = UUID.randomUUID();
    private final UUID bob = UUID.randomUUID();
    private final UUID moderator = UUID.randomUUID();

    @Test
    void aCommentNobodyAnsweredGoesWithHim() {
        var alone = commentService.create(alice, "article", subjectId, "alone").comment();

        erasure.erase(alice);

        assertThat(comments.findById(alone.id())).isEmpty();
    }

    @Test
    void aCommentSomebodyAnsweredIsLeftWithNothingOfHisInIt() {
        var his = commentService.create(alice, "article", subjectId, "his").comment();
        var hers = commentService.reply(bob, his.id(), "hers").comment();

        erasure.erase(alice);

        var left = comments.findById(his.id()).orElseThrow();
        assertThat(left.authorId()).isNull();
        assertThat(left.body()).isNull();
        assertThat(left.isDeleted()).isTrue();
        assertThat(comments.findById(hers.id()).orElseThrow().body()).isEqualTo("hers");
    }

    @Test
    void aGravestoneHisLastCommentWasHoldingUpGoesToo() {
        var top = commentService.create(bob, "article", subjectId, "top").comment();
        var middle = commentService.reply(bob, top.id(), "middle").comment();
        var his = commentService.reply(alice, middle.id(), "his").comment();
        commentService.deleteOwn(bob, middle.id());

        erasure.erase(alice);

        assertThat(comments.findById(his.id())).isEmpty();
        // bob's gravestone had nothing else under it, and it is not his account being erased
        assertThat(comments.findById(middle.id())).isEmpty();
        assertThat(comments.findById(top.id()).orElseThrow().replyCount()).isZero();
    }

    @Test
    void openReportsOnWhatSurvivedAreVoided() {
        var his = commentService.create(alice, "article", subjectId, "his").comment();
        commentService.reply(bob, his.id(), "keeps the node");
        reportService.report(bob, his.id(), "spam");

        erasure.erase(alice);

        assertThat(reports.findAll().stream()
                        .filter(r -> r.commentId().equals(his.id()))
                        .toList())
                .isNotEmpty()
                .allSatisfy(r -> assertThat(r.resolution()).isEqualTo(ReportResolution.VOIDED));
    }

    @Test
    void ignoresGoBothWays() {
        blockService.block(alice, bob, BlockMode.GRAVESTONE);
        blockService.block(bob, alice, BlockMode.SOFT);

        erasure.erase(alice);

        assertThat(blockService.list(alice)).isEmpty();
        assertThat(blockService.list(bob)).isEmpty();
    }

    @Test
    void aRunningBanComesBackAndOutlivesTheErase() {
        var until = Instant.now().plus(Duration.ofHours(3));
        restrictionService.restrictCommenting(alice, moderator, until, "flood");

        var erased = erasure.erase(alice);

        assertThat(erased.banned()).isTrue();
        assertThat(erased.bannedUntil()).isCloseTo(until, within(1, ChronoUnit.SECONDS));
        // kept on purpose: deleting an account must not cut a ban short
        assertThat(restrictionService.activeFor(alice)).hasSize(1);
    }

    @Test
    void aBanAlreadyServedIsSweptUp() {
        restrictions.saveAndFlush(new UserRestriction()
                .userId(alice)
                .capability(UserRestriction.CAPABILITY_COMMENT)
                .issuedBy(moderator)
                .expiresAt(Instant.now().minus(Duration.ofDays(1)))
                .reason("served"));

        var erased = erasure.erase(alice);

        assertThat(erased.banned()).isFalse();
        assertThat(restrictions.findAll().stream()
                        .filter(r -> r.userId().equals(alice))
                        .toList())
                .isEmpty();
    }

    @Test
    void askingTwiceSaysTheSameThing() {
        // written first: the ban below is on commenting, and it holds against him from the moment
        // it is issued, erase or no erase
        commentService.create(alice, "article", subjectId, "alone");
        restrictionService.restrictCommenting(alice, moderator, Instant.now().plus(Duration.ofHours(3)), "flood");

        var first = erasure.erase(alice);
        var second = erasure.erase(alice);

        assertThat(second).isEqualTo(first);
    }
}
