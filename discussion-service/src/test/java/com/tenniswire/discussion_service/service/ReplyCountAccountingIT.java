package com.tenniswire.discussion_service.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.tenniswire.discussion_service.TestcontainersConfiguration;
import com.tenniswire.discussion_service.repository.CommentRepository;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * A comment stops being shown once, and its parent's count comes down once for it.
 *
 * <p>Both cases here need a node with two children, which is what the chain tests do not have: with
 * one child a level, counting the same child out twice and counting it out once leave the parent at
 * the same zero, and the whole thing looks right while a live reply quietly leaves the page.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ReplyCountAccountingIT {

    @Autowired
    private CommentService commentService;

    @Autowired
    private ReportService reportService;

    @Autowired
    private ErasedReaderWriter writer;

    @Autowired
    private CommentRepository commentRepository;

    private final UUID subjectId = UUID.randomUUID();
    private final UUID alice = UUID.randomUUID();
    private final UUID bob = UUID.randomUUID();
    private final UUID carol = UUID.randomUUID();

    @Test
    void emptyingOneReplyOfAPlaceholderLeavesTheOtherStanding() {
        var root =
                commentService.create(alice, "publication", subjectId, "root").comment();
        var placeholder = commentService.reply(alice, root.id(), "P").comment();
        var going = commentService.reply(bob, placeholder.id(), "C").comment();
        commentService.reply(carol, placeholder.id(), "D");
        commentService.deleteOwn(alice, placeholder.id());

        commentService.deleteOwn(bob, going.id());

        assertThat(commentRepository.findById(placeholder.id()).orElseThrow().replyCount())
                .isOne();
        // the one that mattered: the placeholder still stands, so the root never lost anything
        assertThat(commentRepository.findById(root.id()).orElseThrow().replyCount())
                .isOne();

        var branch = commentService.branch(root.id(), null);
        assertThat(branch.replies()).hasSize(1);
        assertThat(branch.replies().getFirst().replies()).hasSize(1);
        assertThat(branch.replies().getFirst().replies().getFirst().comment().body())
                .isEqualTo("D");
    }

    @Test
    void erasingAnAuthorDoesNotCountOutAReplyThatLeftThePageLongAgo() {
        var root =
                commentService.create(alice, "publication", subjectId, "root").comment();
        var pinned = commentService.reply(bob, root.id(), "pinned").comment();
        var staying = commentService.reply(carol, root.id(), "staying").comment();
        reportService.report(carol, pinned.id(), "spam");
        // held in the table by the report, already off the page, already out of the root's count
        commentService.deleteOwn(bob, pinned.id());
        assertThat(commentRepository.findById(root.id()).orElseThrow().replyCount())
                .isOne();

        writer.erase(List.of(pinned.id()));

        assertThat(commentRepository.findById(root.id()).orElseThrow().replyCount())
                .isOne();
        assertThat(commentRepository.findById(staying.id())).isPresent();
        var listed = commentService
                .listTopLevel("publication", subjectId, null, null, null, CommentSort.OLDEST)
                .items();
        assertThat(listed).hasSize(1);
        assertThat(listed.getFirst().repliesTruncated()).isTrue();
    }
}
