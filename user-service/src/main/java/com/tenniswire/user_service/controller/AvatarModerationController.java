package com.tenniswire.user_service.controller;

import com.tenniswire.user_service.dto.AvatarQueueResponse;
import com.tenniswire.user_service.dto.AvatarReviewRequest;
import com.tenniswire.user_service.service.AvatarService;
import com.tenniswire.user_service.service.AvatarUrls;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class AvatarModerationController {

    private static final int MAX_PAGE = 200;

    private final AvatarService avatars;
    private final AvatarUrls urls;

    public AvatarModerationController(AvatarService avatars, AvatarUrls urls) {
        this.avatars = avatars;
        this.urls = urls;
    }

    // First page only: whatever is decided on drops out, so the next call is the next batch
    @GetMapping("/moderation/avatars")
    public AvatarQueueResponse queue(@RequestParam(defaultValue = "50") @Min(1) @Max(MAX_PAGE) int size) {
        return new AvatarQueueResponse(avatars.queue(size).stream()
                .map(profile -> AvatarQueueResponse.Entry.from(profile, urls))
                .toList());
    }

    @PutMapping("/{userId}/avatar/review")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void review(@PathVariable UUID userId, @Valid @RequestBody AvatarReviewRequest request) {
        avatars.review(userId, request.avatarKey());
    }

    // Not a violation and not counted anywhere. Without avatarKey whatever is current goes.
    // "/me/avatar" is a literal and wins over this pattern.
    @DeleteMapping("/{userId}/avatar")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void takeDown(@PathVariable UUID userId, @RequestParam(required = false) @Nullable String avatarKey) {
        avatars.takeDown(userId, avatarKey);
    }
}
