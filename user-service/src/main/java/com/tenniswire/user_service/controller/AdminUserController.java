package com.tenniswire.user_service.controller;

import com.tenniswire.user_service.service.AccountDeletionService;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class AdminUserController {

    private final AccountDeletionService deletions;

    public AdminUserController(AccountDeletionService deletions) {
        this.deletions = deletions;
    }

    // "/me" is a literal and wins over this pattern in Spring's own ordering, so a reader deleting
    // his own account never lands here however the two are declared.
    @DeleteMapping("/{userId}")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void delete(@PathVariable UUID userId) {
        deletions.request(userId);
    }
}
