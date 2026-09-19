package com.tenniswire.discussion_service.controller.reader;

import com.tenniswire.discussion_service.dto.reader.ReactionRequest;
import com.tenniswire.discussion_service.security.CurrentUser;
import com.tenniswire.discussion_service.service.ReactionService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * PUT sets or replaces, DELETE takes back. Both answer 204: the client has already drawn the
 * change, and the counts it draws are its own arithmetic until the page is loaded again.
 */
@RestController
@RequestMapping("/api/discussion/comments/{id}/reactions")
public class ReactionController {

    private final ReactionService reactions;
    private final CurrentUser currentUser;

    public ReactionController(ReactionService reactions, CurrentUser currentUser) {
        this.reactions = reactions;
        this.currentUser = currentUser;
    }

    @PutMapping("/vote")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void setVote(
            @PathVariable UUID id, @Valid @RequestBody ReactionRequest request, @AuthenticationPrincipal Jwt jwt) {
        reactions.setVote(currentUser.id(jwt), id, request.value());
    }

    @DeleteMapping("/vote")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clearVote(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        reactions.clearVote(currentUser.id(jwt), id);
    }

    @PutMapping("/emoji")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void setEmoji(
            @PathVariable UUID id, @Valid @RequestBody ReactionRequest request, @AuthenticationPrincipal Jwt jwt) {
        reactions.setEmoji(currentUser.id(jwt), id, request.value());
    }

    @DeleteMapping("/emoji")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clearEmoji(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        reactions.clearEmoji(currentUser.id(jwt), id);
    }
}
