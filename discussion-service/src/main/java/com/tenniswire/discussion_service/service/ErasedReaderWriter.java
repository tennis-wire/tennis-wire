package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.entity.Comment;
import com.tenniswire.discussion_service.entity.ReportResolution;
import com.tenniswire.discussion_service.repository.AuthorReactionTotalRepository;
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
    private final TreeLock treeLock;
    private final ReportRepository reports;
    private final BlockRepository blocks;
    private final UserRestrictionRepository restrictions;
    private final ReactionService reactions;
    private final PollService pollVotes;
    private final AuthorReactionTotalRepository totals;

    ErasedReaderWriter(
            CommentRepository comments,
            CommentCollapse collapse,
            TreeLock treeLock,
            ReportRepository reports,
            BlockRepository blocks,
            UserRestrictionRepository restrictions,
            ReactionService reactions,
            PollService pollVotes,
            AuthorReactionTotalRepository totals) {
        this.comments = comments;
        this.collapse = collapse;
        this.treeLock = treeLock;
        this.reports = reports;
        this.blocks = blocks;
        this.restrictions = restrictions;
        this.reactions = reactions;
        this.pollVotes = pollVotes;
        this.totals = totals;
    }

    // -batch of his comments: emptied of him, then taken away where nothing stands on them.
    // Order between batches does not matter. A comment of his in a later batch is still standing
    // when an earlier one is collapsed, so it holds its ancestors up; when its own batch comes, the
    // walk goes up through those ancestors and finds them ready to go
    @Transactional
    void erase(List<UUID> batch) {
        // Every tree the batch reaches, before any of it is read
        treeLock.hold(batch);
        // Asked before anonymize touches anything: one of his comments may have gone out of view
        // long ago, held in the table by a report, and its parent's count parted with it back then.
        var wereShown = comments.findAllById(batch).stream()
                .filter(comment -> !comment.isDeleted() || comment.replyCount() > 0)
                .map(Comment::id)
                .collect(Collectors.toSet());
        // Before anonymize: what his comments collected has nowhere to go once he is gone, and the
        // rows would outlive the text they sit under.
        reactions.wipeAll(comments.findAllById(batch));
        comments.anonymize(batch);
        // read back: anonymize wrote around the entities and cleared the context behind it
        collapse.of(comments.findAllById(batch), wereShown);
        reports.closeOpenOn(batch, ReportResolution.VOIDED);
    }

    @Transactional
    void eraseTheRest(UUID readerId, Instant now) {
        blocks.deleteInvolving(readerId);
        restrictions.deleteEndedFor(readerId, now);
        // What he put on other people's comments comes off their counts; what he collected on his
        // own goes with him. A count a removal already swept into someone's total stays: the
        // comment it was collected on is not there to take it off.
        reactions.clearAllBy(readerId);
        pollVotes.clearAllBy(readerId);
        totals.deleteFor(List.of(readerId));
    }
}
