package com.tenniswire.content_service.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// Saved changes to a published article that are not on the site yet. At most one per article, and
// whoever holds it is the only one who may edit the article until it is applied or dropped.
@Entity
@Table(name = "article_edits")
@Getter
@Setter
@NoArgsConstructor
public class ArticleEdit {

    @Id
    @Column(name = "article_id")
    private UUID articleId;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    // As the holder was called when the edit began: shown to whoever finds the article taken
    @Column(name = "owner_name", nullable = false)
    private String ownerName;

    // Json text. Kept as a string rather than mapped: nothing queries into it, and the driver's
    // stringtype=unspecified lets the server cast it to jsonb on write.
    @Column(name = "payload", nullable = false, columnDefinition = "jsonb")
    private String payload;

    // A wrapper, so that a new edit, whose id is assigned, still counts as new and is persisted
    @Version
    private Long version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        var now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
