package com.tenniswire.user_service.controller;

import com.tenniswire.user_service.dto.ProfileResponse;
import com.tenniswire.user_service.dto.UpdateProfileRequest;
import com.tenniswire.user_service.security.CurrentUser;
import com.tenniswire.user_service.service.ProfileService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final CurrentUser currentUser;
    private final ProfileService profiles;

    public UserController(CurrentUser currentUser, ProfileService profiles) {
        this.currentUser = currentUser;
        this.profiles = profiles;
    }

    @GetMapping("/me")
    public ProfileResponse me(@AuthenticationPrincipal Jwt jwt) {
        return ProfileResponse.from(profiles.byId(currentUser.id(jwt)));
    }

    @PatchMapping("/me")
    public ProfileResponse rename(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody UpdateProfileRequest request) {
        return ProfileResponse.from(profiles.rename(currentUser.id(jwt), request.displayName()));
    }
}
