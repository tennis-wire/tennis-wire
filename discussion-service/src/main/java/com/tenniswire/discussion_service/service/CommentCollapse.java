package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.entity.Comment;
import com.tenniswire.discussion_service.repository.ChildTally;
import com.tenniswire.discussion_service.repository.CommentRepository;
import com.tenniswire.discussion_service.repository.ReportRepository;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * The rule of discussion-rules §8.7 in one place: a comment stands while something is left under it
 * and goes when nothing is, and so does whatever it was the last thing holding up. Callers hand in
 * the nodes they have just taken down — one for an author's own delete, a whole account's worth for
 * an erase — and the walk continues upward through comments that need not belong to the same reader.
 *
 * <p>Reads are batched over the entire set rather than repeated per node: one query per level of
 * depth to gather the ancestors, then one each for children and reports. The order is deepest
 * first, so a comment is only judged once every child that could go already has.
 */
@Component
class CommentCollapse {

    private final CommentRepository comments;
    private final ReportRepository reports;

    CommentCollapse(CommentRepository comments, ReportRepository reports) {
        this.comments = comments;
        this.reports = reports;
    }

    /** @return how many comments were taken away */
    int of(Collection<Comment> taken) {
        if (taken.isEmpty()) {
            return 0;
        }
        var known = withAncestors(taken);
        var ids = List.copyOf(known.keySet());
        var children = comments.countChildrenOf(ids).stream()
                .collect(Collectors.toMap(ChildTally::parentId, ChildTally::children, (a, b) -> a, HashMap::new));
        var reported = reports.findReportedAmong(ids);

        var ordered = new ArrayList<>(known.values());
        ordered.sort(Comparator.comparingInt(CommentCollapse::depth).reversed());

        var doomed = new LinkedHashSet<UUID>();
        var lost = new HashMap<UUID, Integer>();
        for (var node : ordered) {
            if (!canGo(node, children, reported)) {
                continue;
            }
            doomed.add(node.id());
            var parent = node.inReplyToId();
            if (parent != null) {
                children.merge(parent, -1L, Long::sum);
                lost.merge(parent, 1, Integer::sum);
            }
        }
        if (doomed.isEmpty()) {
            return 0;
        }
        comments.deleteByIdIn(doomed);
        // Survivors only: a parent that went took its own count away with it.
        lost.forEach((parent, n) -> {
            if (!doomed.contains(parent)) {
                comments.decrementReplyCount(parent, n);
            }
        });
        return doomed.size();
    }

    private static boolean canGo(Comment node, Map<UUID, Long> children, Set<UUID> reported) {
        if (children.getOrDefault(node.id(), 0L) > 0) {
            return false;
        }
        // Nothing is kept for a reader who erased his account: the counter reads author_id and no
        // longer finds him, and the queue is told his reports are void (§13.15, §13.16).
        if (node.hasNoAuthor()) {
            return true;
        }
        // hiddenAt: the counter reads that column, and the author is still there to be counted.
        // countedAt: same, for a violation counted by hand.
        // reported: the queue card outlives the author deleting his own comment (§10.22).
        return node.isDeleted()
                && !node.isHiddenByModeration()
                && node.countedAt() == null
                && !reported.contains(node.id());
    }

    /** One query per level of depth, however many comments came in. */
    private Map<UUID, Comment> withAncestors(Collection<Comment> taken) {
        var known = new LinkedHashMap<UUID, Comment>();
        taken.forEach(c -> known.put(c.id(), c));
        var frontier = parentsOutside(taken, known);
        while (!frontier.isEmpty()) {
            var parents = comments.findAllById(frontier);
            parents.forEach(p -> known.put(p.id(), p));
            frontier = parentsOutside(parents, known);
        }
        return known;
    }

    private static Set<UUID> parentsOutside(Collection<Comment> of, Map<UUID, Comment> known) {
        return of.stream()
                .map(Comment::inReplyToId)
                .filter(Objects::nonNull)
                .filter(id -> !known.containsKey(id))
                .collect(Collectors.toSet());
    }

    // From the ltree path, which is already loaded — cheaper than asking the database for nlevel().
    private static int depth(Comment comment) {
        var path = comment.path();
        var depth = 1;
        for (var i = 0; i < path.length(); i++) {
            if (path.charAt(i) == '.') {
                depth++;
            }
        }
        return depth;
    }
}
