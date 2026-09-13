package com.tenniswire.user_service.service;

import com.tenniswire.user_service.client.KeycloakAdmin;
import com.tenniswire.user_service.entity.IdentityLink;
import com.tenniswire.user_service.entity.PendingIdentityDelete;
import com.tenniswire.user_service.exception.IdentityProviderUnavailableException;
import com.tenniswire.user_service.exception.ResourceNotFoundException;
import com.tenniswire.user_service.repository.IdentityLinkRepository;
import com.tenniswire.user_service.repository.PendingIdentityDeleteRepository;
import com.tenniswire.user_service.repository.ProfileRepository;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * The half of the erase that happens while the reader is still there: the account is written down
 * as on its way out, and the identity behind it is shut — disabled, stripped of everything but the
 * address, every session ended.
 *
 * <p>The rest belongs to the job. A token handed out a moment before the account was disabled is a
 * self-contained JWT and keeps working until it expires, so the profile cannot go yet; and the
 * trace lives in another service, which may not be answering.
 *
 * <p>Not transactional as a whole, deliberately: the call to Keycloak is the slow part, and holding
 * a database transaction open across it would tie up a connection for as long as Keycloak takes.
 */
@Service
@Slf4j
public class AccountDeletionService {

    private final ProfileRepository profiles;
    private final IdentityLinkRepository links;
    private final PendingIdentityDeleteRepository pending;
    private final KeycloakAdmin keycloak;

    public AccountDeletionService(
            ProfileRepository profiles,
            IdentityLinkRepository links,
            PendingIdentityDeleteRepository pending,
            KeycloakAdmin keycloak) {
        this.profiles = profiles;
        this.links = links;
        this.pending = pending;
        this.keycloak = keycloak;
    }

    // Idempotent: asking twice records once, and the second call only retries what did not work
    public void request(UUID userId) {
        var record = pending.findById(userId).orElseGet(() -> record(userId));
        if (record.identityClosedAt() != null) {
            return;
        }
        try {
            keycloak.stripAndDisable(record.subject());
            pending.markIdentityClosed(userId);
        } catch (IdentityProviderUnavailableException e) {
            // Not raised to the caller. The deletion is written down and will happen; an error here
            // would say it had not been accepted, which is the wrong thing to tell someone who has
            // just asked to leave. The job closes what is left, and until it does he can still sign in.
            log.warn("account {} is recorded for deletion but Keycloak would not close it: {}", userId, e.getMessage());
        }
    }

    private PendingIdentityDelete record(UUID userId) {
        if (!profiles.existsById(userId)) {
            throw new ResourceNotFoundException("Profile", userId);
        }
        return pending.save(new PendingIdentityDelete(userId, subjectOf(userId)));
    }

    private String subjectOf(UUID userId) {
        return links.findByUserId(userId).stream()
                .filter(link -> IdentityLink.KEYCLOAK.equals(link.id().provider()))
                .map(link -> link.id().sub())
                .findFirst()
                // A profile always has one: nothing creates one except resolving a subject. If this
                // ever fires, the erase would have deleted the profile and left the account behind.
                .orElseThrow(() -> new IllegalStateException("Profile " + userId + " has no Keycloak identity"));
    }
}
