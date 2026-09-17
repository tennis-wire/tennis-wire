package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.config.ReportProperties;
import com.tenniswire.discussion_service.entity.Block;
import com.tenniswire.discussion_service.entity.BlockId;
import com.tenniswire.discussion_service.entity.BlockMode;
import com.tenniswire.discussion_service.entity.Comment;
import com.tenniswire.discussion_service.exception.CommentAlreadyRemovedException;
import com.tenniswire.discussion_service.exception.ForbiddenException;
import com.tenniswire.discussion_service.exception.ResourceNotFoundException;
import com.tenniswire.discussion_service.repository.BlockRepository;
import com.tenniswire.discussion_service.repository.CommentRepository;
import com.tenniswire.discussion_service.repository.ReportRepository;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ReportService {

    private final CommentRepository comments;
    private final TreeLock treeLock;
    private final BlockRepository blocks;
    private final ReportRepository reports;
    private final ReporterHash hash;
    private final Set<String> reasons;

    public ReportService(
            CommentRepository comments,
            TreeLock treeLock,
            BlockRepository blocks,
            ReportRepository reports,
            ReporterHash hash,
            ReportProperties properties) {
        this.comments = comments;
        this.treeLock = treeLock;
        this.blocks = blocks;
        this.reports = reports;
        this.hash = hash;
        this.reasons = Set.copyOf(properties.reasons());
    }

    public void report(UUID reporterId, UUID commentId, String reason) {
        var comment = reportable(commentId, reason);
        assertTheReaderMay(reporterId, comment);

        if (settledAndUnedited(comment)) {
            // A moderator has read this comment and left it standing. Until its text changes there
            // is nothing new to look at, so the report is taken and goes no further.
            return;
        }
        reports.insertReaderReport(commentId, hash.of(reporterId, commentId), reason);
    }

    // The classifier's own filing. No reader stands behind it, so there is no hash to store and no
    // ignore list to consult: only the state of the comment decides. A moderator does not file
    // here: someone who can act on a comment has no use for putting it in his own queue.
    public void reportAsBot(UUID commentId, String reason) {
        var comment = reportable(commentId, reason);
        if (settledAndUnedited(comment)) {
            return;
        }
        reports.insertBotReport(commentId, reason);
    }

    // What holds whoever is filing: a reason that exists, a comment that exists and still stands
    private Comment reportable(UUID commentId, String reason) {
        if (!reasons.contains(reason)) {
            throw new IllegalArgumentException("Unknown report reason; expected one of " + reasons);
        }
        // Before the comment is read: a report keeps a row the collapse would otherwise take, and one
        // filed while the comment is being taken would meet the foreign key rather than a 404.
        treeLock.hold(commentId);
        var comment =
                comments.findById(commentId).orElseThrow(() -> new ResourceNotFoundException("Comment", commentId));
        if (comment.isHiddenByModeration()) {
            throw new CommentAlreadyRemovedException(comment.id());
        }
        if (comment.hasNoText()) {
            // Nothing left to judge, whether the text went with an erased account or after its thirty
            // days. The row is only still there to carry replies or a record, so whoever is filing is
            // told what a reader sees: that the comment is gone.
            throw new ResourceNotFoundException("Comment", commentId);
        }
        // A comment its own author deleted stays reportable while its text is kept: it can still be
        // judged, and the violation counted against him.
        return comment;
    }

    private void assertTheReaderMay(UUID reporterId, Comment comment) {
        if (comment.authorId().equals(reporterId)) {
            throw new ForbiddenException("A comment cannot be reported by its own author");
        }
        // The only place in this service where the viewer's blocks are read outside rendering.
        // Collapsing leaves the comment reachable once expanded; the other two modes do not.
        var mode = blocks.findById(new BlockId(reporterId, comment.authorId()))
                .map(Block::mode)
                .orElse(null);
        if (mode != null && mode != BlockMode.SOFT) {
            throw new ForbiddenException("An ignored author's comment cannot be reported in this mode");
        }
    }

    private static boolean settledAndUnedited(Comment comment) {
        return comment.reportsClosedAt() != null && !comment.updatedAt().isAfter(comment.reportsClosedAt());
    }
}
