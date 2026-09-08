package com.tenniswire.discussion_service.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.tenniswire.discussion_service.entity.BlockMode;
import com.tenniswire.discussion_service.entity.Comment;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** The three render modes over the same three-level tree: root (alice) -> reply (bob) -> nested (alice). */
class BlockRenderPolicyTest {

    private static final UUID ALICE = UUID.randomUUID();
    private static final UUID BOB = UUID.randomUUID();

    private final Comment root = comment(ALICE, null, 1);
    private final Comment reply = comment(BOB, root.id(), 2);
    private final Comment nested = comment(ALICE, reply.id(), 3);

    @Test
    void noBlocksLeavesEverythingVisible() {
        var views = render(Map.of());

        assertThat(views).hasSize(1);
        assertThat(views.getFirst().visibility()).isEqualTo(Visibility.VISIBLE);
        assertThat(replyView(views).visibility()).isEqualTo(Visibility.VISIBLE);
        assertThat(replyView(views).replies()).hasSize(1);
    }

    @Test
    void softKeepsTheBodyAndTheChildren() {
        var views = render(Map.of(BOB, BlockMode.SOFT));

        var bob = replyView(views);
        assertThat(bob.visibility()).isEqualTo(Visibility.SOFT_HIDDEN);
        assertThat(bob.comment().body()).isNotNull();
        assertThat(bob.replies()).extracting(v -> v.comment().id()).containsExactly(nested.id());
    }

    @Test
    void gravestoneKeepsTheChildren() {
        var views = render(Map.of(BOB, BlockMode.GRAVESTONE));

        var bob = replyView(views);
        assertThat(bob.visibility()).isEqualTo(Visibility.GRAVESTONE);
        assertThat(bob.replies()).extracting(v -> v.comment().id()).containsExactly(nested.id());
    }

    @Test
    void subtreeRemovalDropsTheChildrenTooEvenWhenTheyAreNotBlocked() {
        var views = render(Map.of(BOB, BlockMode.SUBTREE_REMOVAL));

        assertThat(views).hasSize(1);
        assertThat(views.getFirst().replies()).isEmpty();
    }

    @Test
    void subtreeRemovalOnTheRootRemovesTheWholeThread() {
        assertThat(render(Map.of(ALICE, BlockMode.SUBTREE_REMOVAL))).isEmpty();
    }

    @Test
    void deletedBeatsSoftAndGravestoneButNotSubtreeRemoval() {
        reply.deletedAt(Instant.now());

        assertThat(replyView(render(Map.of(BOB, BlockMode.SOFT))).visibility()).isEqualTo(Visibility.DELETED);
        assertThat(replyView(render(Map.of(BOB, BlockMode.GRAVESTONE))).visibility())
                .isEqualTo(Visibility.DELETED);
        assertThat(render(Map.of(BOB, BlockMode.SUBTREE_REMOVAL)).getFirst().replies())
                .isEmpty();
    }

    @Test
    void forestOrdersSiblingsOldestFirstWhateverTheInputOrder() {
        var later = comment(BOB, root.id(), 4);
        var forest = CommentTree.forest(List.of(later, nested, reply, root));

        assertThat(forest).hasSize(1);
        assertThat(forest.getFirst().children())
                .extracting(n -> n.comment().id())
                .containsExactly(reply.id(), later.id());
    }

    private List<CommentView> render(Map<UUID, BlockMode> blocks) {
        return BlockRenderPolicy.apply(CommentTree.forest(List.of(root, reply, nested)), blocks);
    }

    private static CommentView replyView(List<CommentView> views) {
        return views.getFirst().replies().getFirst();
    }

    private static Comment comment(UUID author, UUID parent, int seq) {
        return new Comment()
                .id(UUID.randomUUID())
                .subjectType("article")
                .subjectId(UUID.randomUUID())
                .inReplyToId(parent)
                .authorId(author)
                .body("body " + seq)
                .createdAt(Instant.EPOCH.plusSeconds(seq));
    }
}
