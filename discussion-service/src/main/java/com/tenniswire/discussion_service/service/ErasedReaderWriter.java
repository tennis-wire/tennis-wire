package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.entity.Comment;
import com.tenniswire.discussion_service.entity.ReportResolution;
import com.tenniswire.discussion_service.repository.BlockRepository;
import com.tenniswire.discussion_service.repository.CommentRepository;
import com.tenniswire.discussion_service.repository.ReportRepository;
import com.tenniswire.discussion_service.repository.UserRestrictionRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class ErasedReaderWriter {

    private final CommentRepository comments;
    private final CommentCollapse collapse;
    private final ReportRepository reports;
    private final BlockRepository blocks;
    private final UserRestrictionRepository restrictions;

    ErasedReaderWriter(
            CommentRepository comments,
            CommentCollapse collapse,
            ReportRepository reports,
            BlockRepository blocks,
            UserRestrictionRepository restrictions) {
        this.comments = comments;
        this.collapse = collapse;
        this.reports = reports;
        this.blocks = blocks;
        this.restrictions = restrictions;
    }

    // -batch of his comments: emptied of him, then taken away where nothing stands on them.
    // Order between batches does not matter. A comment of his in a later batch is still standing
    // when an earlier one is collapsed, so it holds its ancestors up; when its own batch comes, the
    // walk goes up through those ancestors and finds them ready to go
    @Transactional
    void erase(List<UUID> batch) {
        // Asked before anonymize touches anything: one of his comments may have gone out of view
        // long ago, held in the table by a report, and its parent's count parted with it back then.
        var wereShown = comments.findAllById(batch).stream()
                .filter(comment -> !comment.isDeleted() || comment.replyCount() > 0)
                .map(Comment::id)
                .collect(Collectors.toSet());
        comments.anonymize(batch);
        // read back: anonymize wrote around the entities and cleared the context behind it
        collapse.of(comments.findAllById(batch), wereShown);
        reports.closeOpenOn(batch, ReportResolution.VOIDED);
    }

    @Transactional
    void eraseTheRest(UUID readerId, Instant now) {
        blocks.deleteInvolving(readerId);
        restrictions.deleteExpiredFor(readerId, now);
    }
}
