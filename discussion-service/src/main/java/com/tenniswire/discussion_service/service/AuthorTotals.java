package com.tenniswire.discussion_service.service;

import static com.tenniswire.discussion_service.entity.CommentReaction.LIKE;
import static com.tenniswire.discussion_service.entity.CommentReaction.SLOT_VOTE;

import com.tenniswire.discussion_service.entity.AuthorReactionChange;
import com.tenniswire.discussion_service.entity.AuthorReactionTotal;
import com.tenniswire.discussion_service.entity.CommentReaction;
import com.tenniswire.discussion_service.repository.AuthorReactionChangeRepository;
import com.tenniswire.discussion_service.repository.AuthorReactionTotalRepository;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.OptionalInt;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

// What each author has collected, on comments still shown and taken down alike. A reaction appends
// a change rather than writing his total: every reaction on any of his comments would otherwise
// queue behind that one row. The fold adds the changes up in batches.
@Component
class AuthorTotals {

    private final AuthorReactionChangeRepository changes;
    private final AuthorReactionTotalRepository totals;

    AuthorTotals(AuthorReactionChangeRepository changes, AuthorReactionTotalRepository totals) {
        this.changes = changes;
        this.totals = totals;
    }

    // Under the comment's counter lock, with the count it goes with
    void record(@Nullable UUID authorId, CommentReaction reaction, int delta) {
        // An erased account's comment has nobody to credit
        if (authorId == null) {
            return;
        }
        changes.save(new AuthorReactionChange()
                .authorId(authorId)
                .slot(reaction.slot())
                .value(reaction.value())
                .delta(delta));
    }

    // One batch, oldest first. Returns how many changes it took, or empty when another instance holds
    // the fold. Deleted by the ids read, not by a range: a change with a lower id that commits after
    // the read would otherwise go with the batch uncounted.
    @Transactional
    OptionalInt fold(int size) {
        if (!changes.tryLockFold()) {
            return OptionalInt.empty();
        }
        var batch = changes.findOldest(PageRequest.of(0, size));
        if (batch.isEmpty()) {
            return OptionalInt.of(0);
        }
        var byAuthor = batch.stream().collect(Collectors.groupingBy(AuthorReactionChange::authorId));
        var held = totals.findAllById(byAuthor.keySet()).stream()
                .collect(Collectors.toMap(AuthorReactionTotal::authorId, Function.identity()));
        var now = Instant.now();
        byAuthor.forEach((authorId, his) -> {
            var total = held.computeIfAbsent(authorId, id -> new AuthorReactionTotal().authorId(id));
            his.forEach(change -> add(total, change));
            totals.save(total.updatedAt(now));
        });
        changes.deleteAllByIdInBatch(
                batch.stream().map(AuthorReactionChange::id).toList());
        return OptionalInt.of(batch.size());
    }

    // An erased reader's total, and what of it has not been folded yet. Waits out a fold in progress:
    // one that read his changes before they went would write his total back after this.
    void forget(UUID authorId) {
        changes.lockFold();
        changes.deleteFor(authorId);
        totals.deleteFor(List.of(authorId));
    }

    AuthorReactions of(UUID authorId) {
        return totals.findById(authorId)
                .map(total ->
                        new AuthorReactions(total.likeCount(), total.dislikeCount(), Map.copyOf(total.emojiCounts())))
                .orElse(AuthorReactions.NONE);
    }

    // Floored at zero, as the counts on a comment are: a negative one would show on his page
    private static void add(AuthorReactionTotal total, AuthorReactionChange change) {
        if (SLOT_VOTE.equals(change.slot())) {
            if (LIKE.equals(change.value())) {
                total.likeCount(Math.max(total.likeCount() + change.delta(), 0));
            } else {
                total.dislikeCount(Math.max(total.dislikeCount() + change.delta(), 0));
            }
            return;
        }
        // Replaced whole, as on the comment: a map changed under Hibernate's feet is not always seen
        var emoji = new HashMap<>(total.emojiCounts());
        var next = emoji.getOrDefault(change.value(), 0L) + change.delta();
        if (next <= 0) {
            emoji.remove(change.value());
        } else {
            emoji.put(change.value(), next);
        }
        total.emojiCounts(emoji);
    }
}
