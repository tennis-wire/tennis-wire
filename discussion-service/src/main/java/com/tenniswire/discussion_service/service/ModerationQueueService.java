package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.entity.Comment;
import com.tenniswire.discussion_service.entity.Report;
import com.tenniswire.discussion_service.entity.ReportResolution;
import com.tenniswire.discussion_service.exception.ResolutionNotApplicableException;
import com.tenniswire.discussion_service.exception.ResourceNotFoundException;
import com.tenniswire.discussion_service.repository.CommentRepository;
import com.tenniswire.discussion_service.repository.OpenReportGroup;
import com.tenniswire.discussion_service.repository.ReasonTally;
import com.tenniswire.discussion_service.repository.ReportRepository;
import com.tenniswire.discussion_service.repository.ReportedBody;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ModerationQueueService {

    public static final int MAX_PAGE_SIZE = 200;

    private final ReportRepository reports;
    private final CommentRepository comments;
    private final TreeLock treeLock;
    private final CommentService commentService;

    public ModerationQueueService(
            ReportRepository reports, CommentRepository comments, TreeLock treeLock, CommentService commentService) {
        this.reports = reports;
        this.comments = comments;
        this.treeLock = treeLock;
        this.commentService = commentService;
    }

    @Transactional(readOnly = true)
    public List<QueuedComment> open(int page, int size) {
        var groups = reports.findOpenGroups(PageRequest.of(page, Math.min(size, MAX_PAGE_SIZE)));
        if (groups.isEmpty()) {
            return List.of();
        }
        var ids = groups.stream().map(OpenReportGroup::commentId).toList();
        var byId = comments.findAllById(ids).stream().collect(Collectors.toMap(Comment::id, Function.identity()));
        var tallies = reports.findOpenTallies(ids).stream().collect(Collectors.groupingBy(ReasonTally::commentId));
        // Only the ones an edit has filled in; the rest read as "the text is the comment's own"
        var reported = reports.findBodyAtFirstOpenReport(ids).stream()
                .filter(row -> row.body() != null)
                .collect(Collectors.toMap(ReportedBody::commentId, ReportedBody::body, (first, later) -> first));

        // The order comes from the grouping query and is kept: heaviest first, oldest to break a tie.
        return groups.stream()
                .map(group -> card(
                        group,
                        byId.get(group.commentId()),
                        tallies.get(group.commentId()),
                        reported.get(group.commentId())))
                .filter(Objects::nonNull)
                .toList();
    }

    // Closes the whole card, not one report of it: the queue is per comment, and so is the
    // decision. Which of them a moderator may write depends on how the comment stands: a comment
    // its author has already deleted is not moderation's to remove, only to count or to let go.
    public void resolve(UUID commentId, ReportResolution resolution, UUID moderatorId) {
        // Here and not only in hideByModerator: the comment read below stays in the persistence
        // context, and hideByModerator would get it back as it stood before the wait.
        treeLock.hold(commentId);
        var comment =
                comments.findById(commentId).orElseThrow(() -> new ResourceNotFoundException("Comment", commentId));
        if (reports.countByCommentIdAndResolvedAtIsNull(commentId) == 0) {
            // No open report means no card. Resolving one is resolving something that is not there.
            throw new ResourceNotFoundException("Open reports on comment", commentId);
        }
        switch (resolution) {
            case HIDDEN -> commentService.hideByModerator(commentId, moderatorId);
            case DISMISSED -> {
                comments.markReportsClosed(commentId);
                reports.closeOpen(commentId, ReportResolution.DISMISSED, moderatorId);
            }
            case COUNTED -> {
                if (!comment.isDeleted() || comment.isHiddenByModeration()) {
                    throw new ResolutionNotApplicableException(
                            "A violation is counted by hand only on a comment its author deleted: " + commentId);
                }
                // The wipe closes the card as it takes the text, so the queue does not lead here
                if (comment.hasNoText()) {
                    throw new ResolutionNotApplicableException(
                            "A violation is counted only while the text is kept: " + commentId);
                }
                comments.markCounted(commentId);
                reports.closeOpen(commentId, ReportResolution.COUNTED, moderatorId);
            }
            case VOIDED, EXPIRED -> throw new IllegalArgumentException(resolution.value() + " is not for a moderator");
        }
    }

    private static QueuedComment card(
            OpenReportGroup group, Comment comment, List<ReasonTally> tallies, @Nullable String bodyAtFirstReport) {
        if (comment == null || comment.hasNoText() || tallies == null) {
            // Only reachable if the comment went away or lost its text between the two queries, which
            // the erase and the wipe can both do. One missing card beats a failed page or a blank one.
            return null;
        }
        var reasons = new HashMap<String, Long>();
        var fromBot = false;
        for (var tally : tallies) {
            reasons.merge(tally.reason(), tally.count(), Long::sum);
            fromBot |= Report.SOURCE_BOT.equals(tally.source());
        }
        return new QueuedComment(
                comment,
                bodyAtFirstReport,
                group.reportCount(),
                group.firstReportedAt(),
                group.lastReportedAt(),
                Map.copyOf(reasons),
                fromBot);
    }
}
