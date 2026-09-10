package com.tenniswire.user_service.entity;

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
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.Generated;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.generator.EventType;

@Entity
@Table(name = "profile")
@DynamicUpdate
@Getter
@Setter
@NoArgsConstructor
public class Profile {

    // Generated on the JVM so the id is known before the flush: identity_link needs it inside the
    // same transaction. The column keeps DEFAULT gen_random_uuid() for rows written outside Hibernate.
    @Id
    @GeneratedValue
    @UuidGenerator(style = UuidGenerator.Style.RANDOM)
    @Column(name = "user_id")
    private UUID userId;

    // Unique case-insensitively (uq_profile_display_name). Generated stubs share this namespace
    // with names people pick, so writers must survive a collision rather than assume uniqueness.
    @Column(name = "display_name", nullable = false)
    private String displayName;

    @Column(name = "display_name_chosen", nullable = false)
    private boolean displayNameChosen;

    // Timestamps: DB-owned (defaults + trigger_profile_updated_at)
    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Generated(event = {EventType.INSERT, EventType.UPDATE})
    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
