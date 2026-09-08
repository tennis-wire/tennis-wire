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

/**
 * One node of a comment tree. The adjacency list ({@link #inReplyToId}) is the source of truth;
 * {@link #path} and {@link #rootId} are derived by the {@code comment_set_path} trigger and are
 * therefore read-only here, re-read from the INSERT ... RETURNING.
 *
 * <p>Tree references are plain ids, not JPA associations: the tree is assembled in memory from
 * flat result sets, and nothing here needs lazy proxies.
 */
@Entity
@Table(name = "comment")
@DynamicUpdate
@Getter
@Setter
@NoArgsConstructor
public class Comment {

    // UUIDv7 generated on the JVM so the id is known before the flush; the column keeps
    // DEFAULT uuidv7() for rows inserted outside Hibernate.
    @Id
    @GeneratedValue
    @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    private UUID id;

    // Identity column; only ever used as the ltree label, never exposed.
    @Generated(event = EventType.INSERT)
    @Column(name = "path_key", insertable = false, updatable = false)
    private Long pathKey;

    // -- Subject anchor --

    @Column(name = "subject_type", nullable = false, updatable = false)
    private String subjectType;

    @Column(name = "subject_id", nullable = false, updatable = false)
    private UUID subjectId;

    // -- Tree --

    @Column(name = "in_reply_to_id", updatable = false)
    private UUID inReplyToId;

    @Generated(event = EventType.INSERT)
    @Column(name = "root_id", insertable = false, updatable = false)
    private UUID rootId;

    // Read as text; ltree operators only appear in native queries.
    @Generated(event = EventType.INSERT)
    @Column(name = "path", insertable = false, updatable = false, columnDefinition = "ltree")
    private String path;

    // -- Content --

    @Column(name = "author_id", nullable = false, updatable = false)
    private UUID authorId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    // Maintained only through CommentRepository.incrementReplyCount so that an entity
    // loaded earlier can never write a stale count back.
    @Column(name = "reply_count", insertable = false, updatable = false)
    private int replyCount;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    // -- Timestamps: DB-owned (defaults + trigger) --

    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Generated(event = {EventType.INSERT, EventType.UPDATE})
    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;

    public boolean isRoot() {
        return inReplyToId == null;
    }

    public boolean isDeleted() {
        return deletedAt != null;
    }
}
