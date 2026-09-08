package com.tenniswire.discussion_service.controller;

import com.tenniswire.discussion_service.dto.CreateRestrictionRequest;
import com.tenniswire.discussion_service.dto.RestrictionResponse;
import com.tenniswire.discussion_service.security.CurrentUser;
import com.tenniswire.discussion_service.service.CommentService;
import com.tenniswire.discussion_service.service.RestrictionService;
import jakarta.validation.Valid;
import java.util.List;
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
 * Moderation surface. Which role may reach what is decided in SecurityConfig: hiding a comment is
 * open to the bot, restrictions are not (auth.md §2).
 */
@RestController
@RequestMapping("/api/discussion/moderation")
public class ModerationController {

    private final CommentService commentService;
    private final RestrictionService restrictionService;
    private final CurrentUser currentUser;

    public ModerationController(
            CommentService commentService, RestrictionService restrictionService, CurrentUser currentUser) {
        this.commentService = commentService;
        this.restrictionService = restrictionService;
        this.currentUser = currentUser;
    }

    @DeleteMapping("/comments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void hideComment(@PathVariable UUID id) {
        commentService.hide(id);
    }

    @PostMapping("/restrictions")
    @ResponseStatus(HttpStatus.CREATED)
    public RestrictionResponse restrict(
            @Valid @RequestBody CreateRestrictionRequest request, @AuthenticationPrincipal Jwt jwt) {
        var restriction = restrictionService.restrictCommenting(
                request.userId(), currentUser.id(jwt), request.expiresAt(), request.reason());
        return RestrictionResponse.from(restriction);
    }

    /** Active restrictions for a user — what the write gate currently sees. */
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
