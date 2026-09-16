package com.tenniswire.user_service.controller;

import com.tenniswire.user_service.dto.PublicProfileResponse;
import com.tenniswire.user_service.dto.ResolvedIdentityResponse;
import com.tenniswire.user_service.security.CurrentUser;
import com.tenniswire.user_service.service.ProfileService;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal")
public class InternalUserController {

    private final CurrentUser currentUser;
    private final ProfileService profiles;

    public InternalUserController(CurrentUser currentUser, ProfileService profiles) {
        this.currentUser = currentUser;
        this.profiles = profiles;
    }

    @PostMapping("/identities/resolve")
    public ResolvedIdentityResponse resolve(@AuthenticationPrincipal Jwt jwt) {
        return new ResolvedIdentityResponse(currentUser.id(jwt));
    }

    // No @Validated on the class, deliberately. Spring MVC validates constraints on handler
    // parameters of a controller by itself, and adding @Validated would wrap this bean in a proxy
    // to say the same thing twice, and raise ConstraintViolationException instead of the
    // MethodArgumentNotValidException the exception handler answers with.
    @GetMapping("/users")
    public List<PublicProfileResponse> lookup(
            @RequestParam("ids") @NotEmpty @Size(max = ProfileService.MAX_LOOKUP_IDS) List<UUID> ids) {
        return profiles.lookup(ids).stream().map(PublicProfileResponse::from).toList();
    }
}
