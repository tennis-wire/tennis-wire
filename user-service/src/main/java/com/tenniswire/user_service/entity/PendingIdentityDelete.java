package com.tenniswire.user_service.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

/**
 * An account that has been asked to go. Everything the erase still owes is here, because none of it
 * can be done while the reader waits: an access token issued a moment before the account was
 * disabled goes on being accepted until it expires, and the trace lives in another service.
 *
 * <p>Written once per account and read by the job until there is nothing left to do, at which point
 * the row goes too.
 */
@Entity
@Table(name = "pending_identity_delete")
@DynamicUpdate
@Getter
@Setter
@NoArgsConstructor
public class PendingIdentityDelete {

    @Id
    @Column(name = "user_id", updatable = false)
    private UUID userId;

    // The Keycloak user id. Held here rather than looked up when needed: identity_link goes with
    // the profile, which can be long before the account itself when a ban holds the address.
    @Column(nullable = false, updatable = false)
    private String subject;

    @Generated(event = EventType.INSERT)
    @Column(name = "requested_at", insertable = false, updatable = false)
    private Instant requestedAt;

    // Disabled, stripped, sessions ended. Null means the request could not reach Keycloak and the
    // job still has to; the wait for an outstanding token counts from this and not from the request.
    @Column(name = "identity_closed_at")
    private Instant identityClosedAt;

    @Column(name = "trace_erased_at")
    private Instant traceErasedAt;

    // Whether a ban keeps the address taken, and until when. Held with no date is a ban with no
    // end (discussion-rules §12.20).
    @Column(name = "address_held", nullable = false)
    private boolean addressHeld;

    @Column(name = "address_held_until")
    private Instant addressHeldUntil;

    @Column(nullable = false)
    private int attempts;

    @Column(name = "last_attempt_at")
    private Instant lastAttemptAt;

    @Column(name = "last_error")
    private String lastError;

    public PendingIdentityDelete(UUID userId, String subject) {
        this.userId = userId;
        this.subject = subject;
    }
}
