package com.tenniswire.discussion_service.controller.reader;

import com.tenniswire.discussion_service.dto.reader.AncestryResponse;
import com.tenniswire.discussion_service.dto.reader.BranchResponse;
import com.tenniswire.discussion_service.dto.reader.CommentCreatedResponse;
import com.tenniswire.discussion_service.dto.reader.CommentPageResponse;
import com.tenniswire.discussion_service.dto.reader.CreateCommentRequest;
import com.tenniswire.discussion_service.dto.reader.CreateReplyRequest;
import com.tenniswire.discussion_service.dto.reader.CreateReportRequest;
import com.tenniswire.discussion_service.security.CurrentUser;
import com.tenniswire.discussion_service.service.CommentService;
import com.tenniswire.discussion_service.service.ReportService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * GET is anonymous but viewer-aware: with a token the viewer's blocks shape the response, without
 * one the tree comes back as-is (soft-deletes still applied).
 */
@RestController
@RequestMapping("/api/discussion/comments")
public class CommentController {

    // Optional on both writes. A client that sends one keeps it for as long as it goes on trying the
    // same text: sent again, it gets the comment written the first time rather than a second one.
    private static final String IDEMPOTENCY_KEY = "Idempotency-Key";

    private final CommentService commentService;
    private final ReportService reportService;
    private final CurrentUser currentUser;
    private final CommentResponses responses;
    private final ViewerResponses viewers;

    public CommentController(
            CommentService commentService,
            ReportService reportService,
            CurrentUser currentUser,
            CommentResponses responses,
            ViewerResponses viewers) {
        this.commentService = commentService;
        this.reportService = reportService;
        this.currentUser = currentUser;
        this.responses = responses;
        this.viewers = viewers;
    }

    /** Top-level comments under a subject; each carries replyCount for the "show N replies" control. */
    @GetMapping
    public CommentPageResponse listTopLevel(
            @RequestParam String subjectType,
            @RequestParam UUID subjectId,
            // Both optional and both left to the service: the default and the ceiling are one
            // decision and belong in one place.
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String cursor,
            @AuthenticationPrincipal Jwt jwt) {
        var viewerId = currentUser.idOrNull(jwt);
        var page = commentService.listTopLevel(subjectType, subjectId, viewerId, limit, cursor);
        return new CommentPageResponse(responses.of(page.items()), page.nextCursor(), viewers.of(viewerId));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CommentCreatedResponse create(
            @Valid @RequestBody CreateCommentRequest request,
            @RequestHeader(name = IDEMPOTENCY_KEY, required = false) @Nullable UUID idempotencyKey,
            @AuthenticationPrincipal Jwt jwt) {
        var authorId = currentUser.id(jwt);
        var profile = responses.profileBeforeWriting(authorId);
        var created = commentService.create(
                authorId, request.subjectType(), request.subjectId(), request.body(), idempotencyKey);
        return responses.created(created, profile);
    }

    @PostMapping("/{id}/replies")
    @ResponseStatus(HttpStatus.CREATED)
    public CommentCreatedResponse reply(
            @PathVariable UUID id,
            @Valid @RequestBody CreateReplyRequest request,
            @RequestHeader(name = IDEMPOTENCY_KEY, required = false) @Nullable UUID idempotencyKey,
            @AuthenticationPrincipal Jwt jwt) {
        var authorId = currentUser.id(jwt);
        var profile = responses.profileBeforeWriting(authorId);
        return responses.created(commentService.reply(authorId, id, request.body(), idempotencyKey), profile);
    }

    // "Show replies": the comment with the part of its subtree one response carries
    @GetMapping("/{id}/branch")
    public BranchResponse branch(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        var view = commentService.branch(id, currentUser.idOrNull(jwt));
        return new BranchResponse(responses.of(view));
    }

    // Direct replies of one comment, paged: how a reader gets past what a branch handed over
    @GetMapping("/{id}/replies")
    public CommentPageResponse replies(
            @PathVariable UUID id,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String cursor,
            @AuthenticationPrincipal Jwt jwt) {
        var page = commentService.replies(id, currentUser.idOrNull(jwt), limit, cursor);
        return new CommentPageResponse(responses.of(page.items()), page.nextCursor(), null);
    }

    /** Permalink: the chain of parents from the thread root down to this comment. */
    @GetMapping("/{id}/ancestry")
    public AncestryResponse ancestry(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        var viewerId = currentUser.idOrNull(jwt);
        var chain = commentService.ancestry(id, viewerId);
        return new AncestryResponse(responses.of(chain), viewers.of(viewerId));
    }

    /**
     * Filing a report. Always empty, always the same: written down, already filed and taken but
     * not queued are three answers the reader must not be able to tell apart.
     */
    @PostMapping("/{id}/reports")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void report(
            @PathVariable UUID id, @Valid @RequestBody CreateReportRequest request, @AuthenticationPrincipal Jwt jwt) {
        reportService.report(currentUser.id(jwt), id, request.reason());
    }

    /** Author's own soft delete. */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        commentService.deleteOwn(currentUser.id(jwt), id);
    }
}
