package com.tenniswire.user_service.controller;

import com.tenniswire.user_service.security.RecentLogin;
import com.tenniswire.user_service.service.AccountDeletionService;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class AdminUserController {

    private final AccountDeletionService deletions;
    private final RecentLogin recentLogin;

    public AdminUserController(AccountDeletionService deletions, RecentLogin recentLogin) {
        this.deletions = deletions;
        this.recentLogin = recentLogin;
    }

    // "/me" is a literal and wins over this pattern in Spring's own ordering, so a reader deleting
    // his own account never lands here however the two are declared.
    @DeleteMapping("/{userId}")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID userId) {
        // As irreversible as readers deleting their own, and asked of whoever does it the same way
        recentLogin.require(jwt);
        deletions.requestOnBehalf(userId);
    }
}
