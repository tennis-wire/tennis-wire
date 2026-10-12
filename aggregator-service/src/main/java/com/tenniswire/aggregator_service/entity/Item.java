package com.tenniswire.aggregator_service.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.Generated;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.generator.EventType;
import org.hibernate.type.SqlTypes;

// A news item in its current state (aggregator.md 5.1)
@Entity
@Table(name = "item")
@DynamicUpdate
@Getter
@Setter
@NoArgsConstructor
public class Item {

    @Id
    @GeneratedValue
    @UuidGenerator(style = UuidGenerator.Style.RANDOM)
    @Column(name = "id")
    private UUID id;

    // The canonical URL, unique: one article, one row
    @Column(name = "url", nullable = false)
    private String url;

    // The first source to send the address; another one sending it does not take the row over
    @Column(name = "source_key", nullable = false, updatable = false)
    private String sourceKey;

    @Column(name = "external_id", nullable = false)
    private String externalId;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "title_before")
    private String titleBefore;

    @Column(name = "lead")
    private String lead;

    @Column(name = "text")
    private String text;

    @Column(name = "author")
    private String author;

    @Column(name = "image_url")
    private String imageUrl;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "first_seen_at", nullable = false)
    private Instant firstSeenAt;

    @Column(name = "language", nullable = false)
    private String language;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "categories", nullable = false)
    private List<String> categories = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "embeds", nullable = false)
    private List<String> embeds = new ArrayList<>();

    @Column(name = "extraction", nullable = false)
    private Extraction extraction;

    @Column(name = "extraction_error")
    private String extractionError;

    // When it arrived here: the term counts from it
    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Generated(event = {EventType.INSERT, EventType.UPDATE})
    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
