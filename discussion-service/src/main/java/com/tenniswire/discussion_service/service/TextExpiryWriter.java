package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.entity.ReportResolution;
import com.tenniswire.discussion_service.repository.CommentRepository;
import com.tenniswire.discussion_service.repository.ReportRepository;
import java.time.Instant;
import java.util.OptionalInt;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class TextExpiryWriter {

    private final CommentRepository comments;
    private final TreeLock treeLock;
    private final ReportRepository reports;

    TextExpiryWriter(CommentRepository comments, TreeLock treeLock, ReportRepository reports) {
        this.comments = comments;
        this.treeLock = treeLock;
        this.reports = reports;
    }

    // One batch past the cutoff: the text goes, and the open reports on it close as expired. Returns
    // how many were due, or empty when another instance holds the wipe.
    //
    // No row is locked before the trees: the collapse writes these rows while holding a tree, and a
    // row held here while waiting for that tree would deadlock with it.
    @Transactional
    OptionalInt erase(Instant cutoff, int size) {
        if (!comments.tryLockTextExpiry()) {
            return OptionalInt.empty();
        }
        var due = comments.findTextKeptBefore(cutoff, PageRequest.of(0, size));
        if (due.isEmpty()) {
            return OptionalInt.of(0);
        }
        treeLock.hold(due);
        comments.eraseTextOf(due, cutoff);
        // The whole batch: a comment the update skipped has no report open, an erase voided them first
        reports.closeOpenOn(due, ReportResolution.EXPIRED);
        return OptionalInt.of(due.size());
    }
}
