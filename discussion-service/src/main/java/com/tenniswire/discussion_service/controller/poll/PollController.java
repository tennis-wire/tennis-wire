package com.tenniswire.discussion_service.controller.poll;

import com.tenniswire.discussion_service.dto.poll.ClosingRequest;
import com.tenniswire.discussion_service.dto.poll.CreatePollRequest;
import com.tenniswire.discussion_service.dto.poll.PollResponse;
import com.tenniswire.discussion_service.dto.poll.UpdatePollRequest;
import com.tenniswire.discussion_service.dto.poll.VoteRequest;
import com.tenniswire.discussion_service.security.CurrentUser;
import com.tenniswire.discussion_service.service.PollService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

// Making and editing are the author's, by role; the vote is the reader's, by his reader id, as a
// reaction is. Reading is anyone's, with the viewer's own choice marked when a reader token is on.
@RestController
@RequestMapping("/api/discussion/polls")
public class PollController {

    private final PollService polls;
    private final CurrentUser currentUser;

    public PollController(PollService polls, CurrentUser currentUser) {
        this.polls = polls;
        this.currentUser = currentUser;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PollResponse create(@Valid @RequestBody CreatePollRequest request, @AuthenticationPrincipal Jwt jwt) {
        var subject = jwt.getSubject();
        if (subject == null) {
            throw new IllegalStateException("Validated token carries no sub");
        }
        return polls.create(UUID.fromString(subject), request);
    }

    @PatchMapping("/{id}")
    public PollResponse update(@PathVariable UUID id, @Valid @RequestBody UpdatePollRequest request) {
        return polls.update(id, request);
    }

    @PutMapping("/{id}/closing")
    public PollResponse close(@PathVariable UUID id, @RequestBody ClosingRequest request) {
        return polls.close(id, request.closesAt());
    }

    @GetMapping("/{id}")
    public PollResponse get(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        return polls.get(id, currentUser.idOrNull(jwt));
    }

    @PutMapping("/{id}/vote")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void vote(@PathVariable UUID id, @Valid @RequestBody VoteRequest request, @AuthenticationPrincipal Jwt jwt) {
        polls.vote(currentUser.id(jwt), id, request.optionId());
    }

    @DeleteMapping("/{id}/vote")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void retract(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        polls.retract(currentUser.id(jwt), id);
    }
}
