package com.tenniswire.discussion_service.controller;

import com.tenniswire.discussion_service.dto.AncestryResponse;
import com.tenniswire.discussion_service.dto.BranchResponse;
import com.tenniswire.discussion_service.dto.CommentCreatedResponse;
import com.tenniswire.discussion_service.dto.CommentPageResponse;
import com.tenniswire.discussion_service.dto.CommentResponse;
import com.tenniswire.discussion_service.dto.CreateCommentRequest;
import com.tenniswire.discussion_service.dto.CreateReplyRequest;
import com.tenniswire.discussion_service.security.CurrentUser;
import com.tenniswire.discussion_service.service.CommentService;
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
    private final CurrentUser currentUser;

    public CommentController(CommentService commentService, CurrentUser currentUser) {
        this.commentService = commentService;
        this.currentUser = currentUser;
    }

    /** Top-level comments under a subject; each carries replyCount for the "show N replies" control. */
    @GetMapping
    public CommentPageResponse listTopLevel(
            @RequestParam String subjectType, @RequestParam UUID subjectId, @AuthenticationPrincipal Jwt jwt) {
        var views = commentService.listTopLevel(subjectType, subjectId, currentUser.idOrNull(jwt));
        return CommentPageResponse.unpaged(CommentResponse.from(views));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CommentCreatedResponse create(
            @Valid @RequestBody CreateCommentRequest request, @AuthenticationPrincipal Jwt jwt) {
        var created =
                commentService.create(currentUser.id(jwt), request.subjectType(), request.subjectId(), request.body());
        return CommentCreatedResponse.from(created);
    }

    @PostMapping("/{id}/replies")
    @ResponseStatus(HttpStatus.CREATED)
    public CommentCreatedResponse reply(
            @PathVariable UUID id, @Valid @RequestBody CreateReplyRequest request, @AuthenticationPrincipal Jwt jwt) {
        return CommentCreatedResponse.from(commentService.reply(currentUser.id(jwt), id, request.body()));
    }

    /** "Show replies": the comment with its whole subtree. */
    @GetMapping("/{id}/branch")
    public BranchResponse branch(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        var view = commentService.branch(id, currentUser.idOrNull(jwt));
        return new BranchResponse(CommentResponse.from(view), null);
    }

    /** Permalink: the chain of parents from the thread root down to this comment. */
    @GetMapping("/{id}/ancestry")
    public AncestryResponse ancestry(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        var chain = commentService.ancestry(id, currentUser.idOrNull(jwt));
        return new AncestryResponse(CommentResponse.from(chain));
    }

    /** Author's own soft delete. */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        commentService.deleteOwn(currentUser.id(jwt), id);
    }
}
