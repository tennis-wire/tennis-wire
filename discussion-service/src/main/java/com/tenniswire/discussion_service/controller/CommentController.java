package com.tenniswire.discussion_service.controller;

import com.tenniswire.discussion_service.dto.AncestryResponse;
import com.tenniswire.discussion_service.dto.BranchResponse;
import com.tenniswire.discussion_service.dto.CommentCreatedResponse;
import com.tenniswire.discussion_service.dto.CommentPageResponse;
import com.tenniswire.discussion_service.dto.CreateCommentRequest;
import com.tenniswire.discussion_service.dto.CreateReplyRequest;
import com.tenniswire.discussion_service.dto.CreateReportRequest;
import com.tenniswire.discussion_service.security.CurrentUser;
import com.tenniswire.discussion_service.service.CommentService;
import com.tenniswire.discussion_service.service.ReportService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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

    private final CommentService commentService;
    private final ReportService reportService;
    private final CurrentUser currentUser;
    private final CommentResponses responses;

    public CommentController(
            CommentService commentService,
            ReportService reportService,
            CurrentUser currentUser,
            CommentResponses responses) {
        this.commentService = commentService;
        this.reportService = reportService;
        this.currentUser = currentUser;
        this.responses = responses;
    }

    /** Top-level comments under a subject; each carries replyCount for the "show N replies" control. */
    @GetMapping
    public CommentPageResponse listTopLevel(
            @RequestParam String subjectType, @RequestParam UUID subjectId, @AuthenticationPrincipal Jwt jwt) {
        var views = commentService.listTopLevel(subjectType, subjectId, currentUser.idOrNull(jwt));
        return CommentPageResponse.unpaged(responses.of(views));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CommentCreatedResponse create(
            @Valid @RequestBody CreateCommentRequest request, @AuthenticationPrincipal Jwt jwt) {
        var authorId = currentUser.id(jwt);
        var profile = responses.profileBeforeWriting(authorId);
        var created = commentService.create(authorId, request.subjectType(), request.subjectId(), request.body());
        return responses.created(created, profile);
    }

    @PostMapping("/{id}/replies")
    @ResponseStatus(HttpStatus.CREATED)
    public CommentCreatedResponse reply(
            @PathVariable UUID id, @Valid @RequestBody CreateReplyRequest request, @AuthenticationPrincipal Jwt jwt) {
        var authorId = currentUser.id(jwt);
        var profile = responses.profileBeforeWriting(authorId);
        return responses.created(commentService.reply(authorId, id, request.body()), profile);
    }

    /** "Show replies": the comment with its whole subtree. */
    @GetMapping("/{id}/branch")
    public BranchResponse branch(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        var view = commentService.branch(id, currentUser.idOrNull(jwt));
        return new BranchResponse(responses.of(view), null);
    }

    /** Permalink: the chain of parents from the thread root down to this comment. */
    @GetMapping("/{id}/ancestry")
    public AncestryResponse ancestry(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        var chain = commentService.ancestry(id, currentUser.idOrNull(jwt));
        return new AncestryResponse(responses.of(chain));
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
