package com.tenniswire.user_service.service;

import com.tenniswire.user_service.client.KeycloakAdmin;
import com.tenniswire.user_service.client.ReaderTraceClient;
import com.tenniswire.user_service.config.ErasureProperties;
import com.tenniswire.user_service.entity.PendingIdentityDelete;
import com.tenniswire.user_service.repository.DisplayNameReservationRepository;
import com.tenniswire.user_service.repository.PendingIdentityDeleteRepository;
import com.tenniswire.user_service.repository.ProfileRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What is left of an account once the reader has gone, carried one step at a time. Nothing here can
 * be done while he waits: a token handed out a moment before his account was disabled goes on being
 * accepted until it expires, and the trace lives in another service that may not be answering.
 *
 * <p>Each account advances in its own transaction, so one that cannot be finished does not hold up
 * the rest. Every step is safe to repeat, which is what lets the job come back to a half-done
 * account and simply carry on.
 */
@Service
@Slf4j
public class AccountErasure {

    private static final int ERROR_KEPT = 500;

    private final PendingIdentityDeleteRepository pending;
    private final ProfileRepository profiles;
    private final DisplayNameReservationRepository names;
    private final ReaderTraceClient traces;
    private final KeycloakAdmin keycloak;
    private final ErasureProperties properties;

    public AccountErasure(
            PendingIdentityDeleteRepository pending,
            ProfileRepository profiles,
            DisplayNameReservationRepository names,
            ReaderTraceClient traces,
            KeycloakAdmin keycloak,
            ErasureProperties properties) {
        this.pending = pending;
        this.profiles = profiles;
        this.names = names;
        this.traces = traces;
        this.keycloak = keycloak;
        this.properties = properties;
    }

    /**
     * Accounts to look at this pass, oldest request first. Not filtered: the table holds one row per
     * account on its way out and empties itself, so reading it whole costs less than a query that
     * has to encode every reason a row might not be due.
     */
    @Transactional(readOnly = true)
    public List<UUID> due() {
        return pending.oldestFirst(PageRequest.of(0, properties.batchSize()));
    }

    /** One step for one account. Failures are recorded on the row rather than thrown at the job. */
    @Transactional
    public void advance(UUID userId, Duration grace) {
        // Claimed rather than read: two instances running the same pass would otherwise both work
        // the same account. Every step survives that, but the attempt count and the log would not
        // be worth reading afterwards.
        var record = pending.claim(userId).orElse(null);
        if (record == null) {
            return;
        }
        try {
            step(record, grace);
        } catch (RuntimeException e) {
            record.attempts(record.attempts() + 1).lastAttemptAt(Instant.now()).lastError(shorten(e));
            if (backoff(record.attempts()).compareTo(properties.retryCap()) >= 0) {
                // Slowed all the way down and still failing. Nothing here will fix it, so say so
                // where it will be seen rather than go on warning once a minute for ever.
                log.error(
                        "erasing account {} has failed {} times and is now retried at the slowest rate: {}",
                        userId,
                        record.attempts(),
                        e.getMessage());
            } else {
                log.warn("erasing account {} did not get further this pass: {}", userId, e.getMessage());
            }
        }
    }

    private void step(PendingIdentityDelete record, Duration grace) {
        var now = Instant.now();

        if (record.identityClosedAt() == null) {
            // The request could not reach Keycloak. Nothing has been closed yet, so there is
            // nothing to outwait either — the clock starts here and the rest waits for next pass.
            keycloak.stripAndDisable(record.subject());
            record.identityClosedAt(now);
            return;
        }
        if (now.isBefore(record.identityClosedAt().plus(grace))) {
            return;
        }
        if (tooSoonToLookAgain(record, now)) {
            return;
        }

        // Asked again every time rather than read off the row. Nothing tells this service when a
        // ban is lifted, and a permanent one lifted after the account went would otherwise hold the
        // address for good. The answer is the truth; what the row keeps is a record of it.
        var erased = traces.erase(record.userId());
        record.traceErasedAt(now)
                .addressHeld(erased.banned())
                .addressHeldUntil(erased.bannedUntil())
                .lastAttemptAt(now);

        // Only now, and not before: resolving a subject creates a profile, so a token still good
        // would have made him a new one, with a new name, and undone the deletion by itself.
        holdTheName(record.userId());
        profiles.deleteById(record.userId());

        if (erased.banned()) {
            // The address stays taken until the ban runs out, or for good if it has no end
            // (discussion-rules §12.20). Everything else about him is already gone.
            return;
        }
        keycloak.delete(record.subject());
        pending.delete(record);
    }

    private void holdTheName(UUID userId) {
        profiles.findById(userId)
                .ifPresent(profile ->
                        names.hold(profile.displayName(), Instant.now().plus(properties.nameHeld())));
    }

    // Names whose month is up. Swept from here because this is the only clock the service has
    @Transactional
    public void releaseNamesHeldLongEnough() {
        names.release(Instant.now());
    }

    // Two reasons to leave an account alone for a while, and they want different waits. An address a
    // ban is holding is asked about on a steady cadence, because only the answer can say whether the
    // ban is still there. An account that keeps failing is asked about less and less, because
    // whatever is wrong is not going to be fixed by asking sooner
    private boolean tooSoonToLookAgain(PendingIdentityDelete record, Instant now) {
        if (record.lastAttemptAt() == null) {
            return false;
        }
        var wait = record.addressHeld() ? properties.recheck() : backoff(record.attempts());
        return now.isBefore(record.lastAttemptAt().plus(wait));
    }

    private Duration backoff(int attempts) {
        var wait = properties.retryBackoff().multipliedBy(attempts);
        return wait.compareTo(properties.retryCap()) > 0 ? properties.retryCap() : wait;
    }

    private static String shorten(RuntimeException e) {
        var message = e.getClass().getSimpleName() + ": " + e.getMessage();
        return message.length() <= ERROR_KEPT ? message : message.substring(0, ERROR_KEPT);
    }
}
