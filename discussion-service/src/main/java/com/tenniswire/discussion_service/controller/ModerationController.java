package com.tenniswire.discussion_service.controller;

import com.tenniswire.discussion_service.dto.BotReportRequest;
import com.tenniswire.discussion_service.dto.CreateRestrictionRequest;
import com.tenniswire.discussion_service.dto.ModerationQueueResponse;
import com.tenniswire.discussion_service.dto.ResolveReportsRequest;
import com.tenniswire.discussion_service.dto.RestrictionResponse;
import com.tenniswire.discussion_service.entity.ReportResolution;
import com.tenniswire.discussion_service.security.CurrentUser;
import com.tenniswire.discussion_service.service.CommentService;
import com.tenniswire.discussion_service.service.ModerationQueueService;
import com.tenniswire.discussion_service.service.ReportService;
import com.tenniswire.discussion_service.service.RestrictionService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/discussion/moderation")
public class ModerationController {

    private static final String OPEN = "open";

    private final CommentService commentService;
    private final RestrictionService restrictionService;
    private final ModerationQueueService queueService;
    private final ModerationQueueResponses queueResponses;
    private final ReportService reportService;
    private final CurrentUser currentUser;

    public ModerationController(
            CommentService commentService,
            RestrictionService restrictionService,
            ModerationQueueService queueService,
            ModerationQueueResponses queueResponses,
            ReportService reportService,
            CurrentUser currentUser) {
        this.commentService = commentService;
        this.restrictionService = restrictionService;
        this.queueService = queueService;
        this.queueResponses = queueResponses;
        this.reportService = reportService;
        this.currentUser = currentUser;
    }

    @DeleteMapping("/comments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void hideComment(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        // The bot reaches this too and has no reader profile, so its removals are recorded unsigned.
        if (currentUser.isModerator()) {
            commentService.hideByModerator(id, currentUser.id(jwt));
        } else {
            commentService.hideByBot(id);
        }
    }

    // The classifier putting a comment in front of a person. Empty like a reader's own filing, and
    // for the same reason turned around: whether this is the first report or a repeat is not
    // something the caller acts on
    @PostMapping("/reports")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reportAsBot(@Valid @RequestBody BotReportRequest request) {
        reportService.reportAsBot(request.commentId(), request.reason());
    }

    // The queue: one card per reported comment, not one per report
    @GetMapping("/reports")
    public ModerationQueueResponse reports(
            @RequestParam(defaultValue = OPEN) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        if (!OPEN.equals(status)) {
            throw new IllegalArgumentException("Only status=open is served today");
        }
        if (page < 0 || size < 1) {
            throw new IllegalArgumentException("page must not be negative and size must be at least 1");
        }
        var capped = Math.min(size, ModerationQueueService.MAX_PAGE_SIZE);
        return queueResponses.of(queueService.open(page, capped), page, capped);
    }

    // The decision on a card, addressed by the comment it is about. One comment can carry many
    // reports and they are all closed together; there is nothing to decide about one of them alone
    @PatchMapping("/reports/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resolve(
            @PathVariable UUID commentId,
            @Valid @RequestBody ResolveReportsRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        queueService.resolve(commentId, ReportResolution.fromValue(request.resolution()), currentUser.id(jwt));
    }

    @PostMapping("/restrictions")
    @ResponseStatus(HttpStatus.CREATED)
    public RestrictionResponse restrict(
            @Valid @RequestBody CreateRestrictionRequest request, @AuthenticationPrincipal Jwt jwt) {
        var restriction = restrictionService.restrictCommenting(
                request.userId(), currentUser.id(jwt), request.expiresAt(), request.reason());
        return RestrictionResponse.from(restriction);
    }

    // Active restrictions for a user — what the write gate currently sees
    @GetMapping("/restrictions")
    public List<RestrictionResponse> active(@RequestParam UUID userId) {
        return RestrictionResponse.from(restrictionService.activeFor(userId));
    }

    @DeleteMapping("/restrictions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void lift(@PathVariable UUID id) {
        restrictionService.lift(id);
    }
}
