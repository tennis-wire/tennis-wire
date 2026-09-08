package com.tenniswire.discussion_service.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Generated;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.generator.EventType;

/**
 * A moderator's decision projected into this service: while active, the user may not exercise
 * {@link #capability}. The audit trail of that decision lives in the moderation domain.
 */
@Entity
@Table(name = "user_restriction")
@Getter
@Setter
@NoArgsConstructor
public class UserRestriction {

    public static final String CAPABILITY_COMMENT = "comment";

    @Id
    @GeneratedValue
    @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(nullable = false, updatable = false)
    private String capability = CAPABILITY_COMMENT;

    // null = indefinite
    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "issued_by", nullable = false, updatable = false)
    private UUID issuedBy;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;
}
