package com.tenniswire.user_service.controller;

import com.tenniswire.user_service.dto.ProfileResponse;
import com.tenniswire.user_service.dto.ReaderProfileResponse;
import com.tenniswire.user_service.dto.UpdateProfileRequest;
import com.tenniswire.user_service.security.CurrentUser;
import com.tenniswire.user_service.security.RecentLogin;
import com.tenniswire.user_service.service.AccountDeletionService;
import com.tenniswire.user_service.service.AvatarService;
import com.tenniswire.user_service.service.AvatarUrls;
import com.tenniswire.user_service.service.ProfileService;
import jakarta.validation.Valid;
import java.io.IOException;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final CurrentUser currentUser;
    private final ProfileService profiles;
    private final AccountDeletionService deletions;
    private final RecentLogin recentLogin;
    private final AvatarService avatars;
    private final AvatarUrls urls;

    public UserController(
            CurrentUser currentUser,
            ProfileService profiles,
            AccountDeletionService deletions,
            RecentLogin recentLogin,
            AvatarService avatars,
            AvatarUrls urls) {
        this.currentUser = currentUser;
        this.profiles = profiles;
        this.deletions = deletions;
        this.recentLogin = recentLogin;
        this.avatars = avatars;
        this.urls = urls;
    }

    @GetMapping("/me")
    public ProfileResponse me(@AuthenticationPrincipal Jwt jwt) {
        return ProfileResponse.from(profiles.byId(currentUser.id(jwt)), urls);
    }

    @PatchMapping("/me")
    public ProfileResponse rename(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody UpdateProfileRequest request) {
        return ProfileResponse.from(profiles.rename(currentUser.id(jwt), request.displayName()), urls);
    }

    // Anyone's profile by id, for the page a name under a comment leads to. Anonymous, like the
    // comments themselves. "/me" is a literal and wins over this pattern in Spring's own ordering.
    @GetMapping("/{userId}")
    public ReaderProfileResponse reader(@PathVariable UUID userId) {
        return ReaderProfileResponse.from(profiles.byId(userId), urls);
    }

    // Anything JPEG, PNG or WebP; what is stored is always re-encoded
    @PostMapping(path = "/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ProfileResponse setAvatar(@AuthenticationPrincipal Jwt jwt, @RequestPart("file") MultipartFile file)
            throws IOException {
        var userId = currentUser.id(jwt);
        avatars.set(userId, file.getBytes());
        return ProfileResponse.from(profiles.byId(userId), urls);
    }

    @DeleteMapping("/me/avatar")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeAvatar(@AuthenticationPrincipal Jwt jwt) {
        avatars.remove(currentUser.id(jwt));
    }

    // 202 rather than 204: what is over when this returns is the reader's part. His account is shut
    // and he is out of it, but the erase itself finishes out of band.
    @DeleteMapping("/me")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void delete(@AuthenticationPrincipal Jwt jwt) {
        // Ahead of resolving the reader: a refused request leaves nothing behind, not even a profile
        recentLogin.require(jwt);
        deletions.request(currentUser.id(jwt));
    }
}
