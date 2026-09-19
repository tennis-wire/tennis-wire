package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.entity.AuthorReactionTotal;
import com.tenniswire.discussion_service.entity.Comment;
import com.tenniswire.discussion_service.repository.AuthorReactionTotalRepository;
import java.time.Instant;
import java.util.HashMap;
import org.springframework.stereotype.Component;

/**
 * What an author collected on comments that are no longer shown. A comment's reaction rows go when
 * the comment does, so the numbers have to be moved somewhere before that happens, or they are only
 * ever the numbers of what still stands.
 *
 * <p>Callers hold the comment's counter lock, taken before they read the row.
 */
@Component
class AuthorTotals {

    private final AuthorReactionTotalRepository totals;

    AuthorTotals(AuthorReactionTotalRepository totals) {
        this.totals = totals;
    }

    /**
     * Adds the comment's counts to its author's running total and zeroes them on the comment. The
     * zeroing is what makes this safe to run twice: a comment its author took down and moderation
     * then removed passes through here a second time and adds nothing.
     */
    void absorb(Comment comment) {
        // An erased account's comment has no author to credit, and his total row is gone with him
        if (comment.authorId() == null || nothingOn(comment)) {
            return;
        }
        var total = totals.findById(comment.authorId())
                .orElseGet(() -> new AuthorReactionTotal().authorId(comment.authorId()));
        var emoji = new HashMap<>(total.emojiCounts());
        comment.emojiCounts().forEach((key, count) -> emoji.merge(key, count.longValue(), Long::sum));

        total.likeCount(total.likeCount() + comment.likeCount())
                .dislikeCount(total.dislikeCount() + comment.dislikeCount())
                .emojiCounts(emoji)
                .updatedAt(Instant.now());
        totals.save(total);

        comment.likeCount(0).dislikeCount(0).emojiCounts(new HashMap<>());
    }

    private static boolean nothingOn(Comment comment) {
        return comment.likeCount() == 0
                && comment.dislikeCount() == 0
                && comment.emojiCounts().isEmpty();
    }
}
