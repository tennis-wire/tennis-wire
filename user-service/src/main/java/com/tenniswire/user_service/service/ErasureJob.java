package com.tenniswire.user_service.service;

import com.tenniswire.user_service.client.KeycloakAdmin;
import com.tenniswire.user_service.config.ErasureProperties;
import com.tenniswire.user_service.exception.IdentityProviderUnavailableException;
import java.time.Duration;
import java.time.Instant;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@EnableScheduling
@ConditionalOnProperty(prefix = "user.erasure", name = "enabled", havingValue = "true", matchIfMissing = true)
@Slf4j
public class ErasureJob {

    private final AccountErasure erasure;
    private final KeycloakAdmin keycloak;
    private final ErasureProperties properties;

    // Read from the realm rather than configured, so the wait cannot quietly fall short of what it
    // is waiting for. Only ever touched by the scheduler, which is one thread.
    private Duration lifespan;
    private Instant lifespanReadAt;

    public ErasureJob(AccountErasure erasure, KeycloakAdmin keycloak, ErasureProperties properties) {
        this.erasure = erasure;
        this.keycloak = keycloak;
        this.properties = properties;
    }

    @Scheduled(fixedDelayString = "${user.erasure.interval}")
    public void pass() {
        // Before anything that might cut the pass short: a name whose month is up is free whether
        // or not Keycloak is answering today.
        erasure.releaseNamesHeldLongEnough();

        Duration grace;
        try {
            grace = accessTokenLifespan().plus(properties.graceMargin());
        } catch (IdentityProviderUnavailableException e) {
            // Nothing is taken away on a guess. An account that waits another minute is a delay; an
            // account erased while a token of his is still good comes back with a new profile.
            log.warn("erase pass skipped: the realm would not say how long its tokens last ({})", e.getMessage());
            return;
        }
        for (var userId : erasure.due()) {
            try {
                erasure.advance(userId, grace);
            } catch (RuntimeException e) {
                // advance records what went wrong on the row itself, but a failure at commit time
                // escapes even that: the transaction is already marked rollback-only, and the write
                // meant to record the failure rolls back with it. One account is not allowed to
                // take the rest of the pass with it.
                log.warn("account {} could not be advanced this pass: {}", userId, e.getMessage());
            }
        }
    }

    private Duration accessTokenLifespan() {
        var now = Instant.now();
        if (lifespan == null || now.isAfter(lifespanReadAt.plus(properties.lifespanCache()))) {
            lifespan = keycloak.accessTokenLifespan();
            lifespanReadAt = now;
        }
        return lifespan;
    }
}
