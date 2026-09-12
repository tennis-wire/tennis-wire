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
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.Generated;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.generator.EventType;

@Entity
@Table(name = "report")
@DynamicUpdate
@Getter
@Setter
@NoArgsConstructor
public class Report {

    public static final String SOURCE_USER = "user";
    public static final String SOURCE_BOT = "bot";

    @Id
    @GeneratedValue
    @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    private UUID id;

    @Column(name = "comment_id", nullable = false, updatable = false)
    private UUID commentId;

    // null for the bot, and for every resolved report
    @Column(name = "reporter_hash")
    private byte[] reporterHash;

    @Column(nullable = false, updatable = false)
    private String source = SOURCE_USER;

    @Column(nullable = false, updatable = false)
    private String reason;

    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    // null for VOIDED, which the erase job writes with no moderator behind it
    @Column(name = "resolved_by")
    private UUID resolvedBy;

    @Column(name = "resolution")
    private ReportResolution resolution;

    public boolean isOpen() {
        return resolvedAt == null;
    }

    public boolean isFromBot() {
        return SOURCE_BOT.equals(source);
    }
}
