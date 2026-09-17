package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.repository.CommentRepository;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

// One writer at a time on a comment tree, from its first read to its commit. The collapse decides
// from counts it reads, and two writers acting on the same counts leave a placeholder with nothing
// under it, a parent counting a reply nobody is shown, or a reply hanging off a comment that came
// down while it was being written.
//
// Held before the first comment is read in the transaction, not just before the write: an entity
// read earlier stays in the persistence context and comes back unchanged after the wait. And the
// wait only helps under read committed, where the next statement sees what the other writer did.
@Component
class TreeLock {

    private final CommentRepository comments;

    TreeLock(CommentRepository comments) {
        this.comments = comments;
    }

    void hold(UUID commentId) {
        hold(List.of(commentId));
    }

    // Each key once and in ascending order: an erase holds many trees, and two erases crossing the
    // same trees in different orders would wait on each other. A comment that is not there takes
    // nothing, and the read that follows tells the caller.
    void hold(Collection<UUID> commentIds) {
        comments.findRootIdsOf(commentIds).stream()
                .mapToLong(TreeLock::key)
                .distinct()
                .sorted()
                .forEach(comments::lockTree);
    }

    // 128 bits into the lock's 64. Two trees sharing a key only queue behind each other.
    private static long key(UUID rootId) {
        return rootId.getMostSignificantBits() ^ rootId.getLeastSignificantBits();
    }
}
