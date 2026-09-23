package com.tenniswire.discussion_service.controller.reader;

import com.tenniswire.discussion_service.dto.reader.AncestryResponse;
import com.tenniswire.discussion_service.dto.reader.BranchResponse;
import com.tenniswire.discussion_service.dto.reader.CommentCountResponse;
import com.tenniswire.discussion_service.dto.reader.CommentCreatedResponse;
import com.tenniswire.discussion_service.dto.reader.CommentPageResponse;
import com.tenniswire.discussion_service.dto.reader.CreateCommentRequest;
import com.tenniswire.discussion_service.dto.reader.CreateReplyRequest;
import com.tenniswire.discussion_service.dto.reader.CreateReportRequest;
import com.tenniswire.discussion_service.dto.reader.EditCommentRequest;
import com.tenniswire.discussion_service.dto.reader.EditedCommentResponse;
import com.tenniswire.discussion_service.security.CurrentUser;
import com.tenniswire.discussion_service.service.CommentService;
import com.tenniswire.discussion_service.service.CommentSort;
import com.tenniswire.discussion_service.service.ReportService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
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
    // params: the author listing answers on the same path, and the two conditions have to exclude
    // each other - a request carrying both matches both mappings and dispatch throws
    @GetMapping(params = {"subjectType", "!authorId"})
    public CommentPageResponse listTopLevel(
            @RequestParam String subjectType,
            @RequestParam UUID subjectId,
            // Both optional and both left to the service: the default and the ceiling are one
            // decision and belong in one place.
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String cursor,
            // A cursor is cut for one order and refused by the others, so the client sends the same
            // sort with every page of a listing.
            @RequestParam(required = false) String sort,
            @AuthenticationPrincipal Jwt jwt) {
        var viewerId = currentUser.idOrNull(jwt);
        var page = commentService.listTopLevel(
                subjectType, subjectId, viewerId, limit, cursor, CommentSort.fromValue(sort));
        return new CommentPageResponse(responses.of(page.items(), viewerId), page.nextCursor(), viewers.of(viewerId));
    }

    // His own cabinet and his profile as others see it read the same endpoint: the viewer's ignore
    // shapes the second one as it shapes a thread.
    @GetMapping(params = {"authorId", "!subjectType"})
    public CommentPageResponse listByAuthor(
            @RequestParam UUID authorId,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String cursor,
            @AuthenticationPrincipal Jwt jwt) {
        var viewerId = currentUser.idOrNull(jwt);
        var page = commentService.listByAuthor(authorId, viewerId, limit, cursor);
        // No viewer standing: this listing opens no thread and has nothing to write into
        return new CommentPageResponse(responses.of(page.items(), viewerId), page.nextCursor(), null);
    }

    // The number under the name on a profile. Not viewer-shaped, unlike the listing above, except
    // that a restricted author's count is for himself only, as his listing is.
    @GetMapping("/count")
    public CommentCountResponse countByAuthor(@RequestParam UUID authorId, @AuthenticationPrincipal Jwt jwt) {
        return new CommentCountResponse(commentService.countByAuthor(authorId, currentUser.idOrNull(jwt)));
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
        var viewerId = currentUser.idOrNull(jwt);
        return new BranchResponse(responses.of(commentService.branch(id, viewerId), viewerId));
    }

    // Direct replies of one comment, paged: how a reader gets past what a branch handed over
    @GetMapping("/{id}/replies")
    public CommentPageResponse replies(
            @PathVariable UUID id,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String cursor,
            @AuthenticationPrincipal Jwt jwt) {
        var viewerId = currentUser.idOrNull(jwt);
        var page = commentService.replies(id, viewerId, limit, cursor);
        return new CommentPageResponse(responses.of(page.items(), viewerId), page.nextCursor(), null);
    }

    /** Permalink: the chain of parents from the thread root down to this comment. */
    @GetMapping("/{id}/ancestry")
    public AncestryResponse ancestry(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        var viewerId = currentUser.idOrNull(jwt);
        var chain = commentService.ancestry(id, viewerId);
        return new AncestryResponse(responses.of(chain, viewerId), viewers.of(viewerId));
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

    /** Author's own correction. No idempotency key: sending the same text twice changes nothing. */
    @PatchMapping("/{id}")
    public EditedCommentResponse edit(
            @PathVariable UUID id, @Valid @RequestBody EditCommentRequest request, @AuthenticationPrincipal Jwt jwt) {
        return EditedCommentResponse.from(commentService.editOwn(currentUser.id(jwt), id, request.body()));
    }

    /** Author's own soft delete. */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        commentService.deleteOwn(currentUser.id(jwt), id);
    }
}
