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

    public static final String HIDDEN_BY_MODERATOR = "moderator";
    public static final String HIDDEN_BY_BOT = "bot";

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

    @Column(name = "subject_type", nullable = false, updatable = false)
    private String subjectType;

    @Column(name = "subject_id", nullable = false, updatable = false)
    private UUID subjectId;

    @Column(name = "in_reply_to_id", updatable = false)
    private UUID inReplyToId;

    @Generated(event = EventType.INSERT)
    @Column(name = "root_id", insertable = false, updatable = false)
    private UUID rootId;

    // Read as text; ltree operators only appear in native queries.
    @Generated(event = EventType.INSERT)
    @Column(name = "path", insertable = false, updatable = false, columnDefinition = "ltree")
    private String path;

    // Both are empty on a comment whose author erased his account and that had to be kept because
    // something still stands on it. Nothing writes that through the entity: the columns stay
    // non-updatable and unwritable here, and the erase clears them in one statement of its own.
    // A comment still standing always has both — the chk_comment_whole_while_standing constraint.

    @Column(name = "author_id", updatable = false)
    private UUID authorId;

    @Column(columnDefinition = "TEXT")
    private String body;

    // Maintained only through CommentRepository.incrementReplyCount so that an entity
    // loaded earlier can never write a stale count back.
    @Column(name = "reply_count", insertable = false, updatable = false)
    private int replyCount;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    // deletedAt cannot carry this on its own: the author's own delete and a removal by moderation
    // write the same thing, while the rules keep them apart. A report is accepted on a comment its
    // author deleted and refused on one moderation removed, and only the second counts against the
    // author.

    @Column(name = "hidden_at")
    private Instant hiddenAt;

    // null when the bot removed it: a service account has no reader profile to name
    @Column(name = "hidden_by")
    private UUID hiddenBy;

    @Column(name = "hidden_source")
    private String hiddenSource;

    // When moderation last closed the reports on this comment without removing it. The comment
    // becomes reportable again once edited, and updatedAt is what proves an edit happened: its
    // trigger fires on a body change only, so no moderation write can pass for one.
    @Column(name = "reports_closed_at")
    private Instant reportsClosedAt;

    // Violation counted by hand on a comment its author had already deleted. Excludes hiddenAt.
    @Column(name = "counted_at")
    private Instant countedAt;

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

    public boolean isHiddenByModeration() {
        return hiddenAt != null;
    }

    // True once the author erased his account: no name to show and no text left to read
    public boolean hasNoAuthor() {
        return authorId == null;
    }
}
