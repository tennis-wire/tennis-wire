package com.tenniswire.content_service.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "articles")
@Getter
@Setter
@NoArgsConstructor
public class Article {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "type", nullable = false, columnDefinition = "article_type")
    private ArticleType type;

    @Column(name = "status", nullable = false, columnDefinition = "article_status")
    private ArticleStatus status = ArticleStatus.DRAFT;

    // -- Main content --

    @Column(nullable = false, length = 500)
    private String title;

    private String subtitle;

    @Column(nullable = false, unique = true, length = 500)
    private String slug;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(name = "cover_image_url", length = 2000)
    private String coverImageUrl;

    @Column(name = "reading_time")
    private Integer readingTime;

    // -- Attribution --

    @Column(name = "source_url", length = 2000)
    private String sourceUrl;

    @Column(name = "source_name", length = 300)
    private String sourceName;

    @Column(name = "author_id")
    private UUID authorId;

    // -- Aggregator fields --

    @Column(name = "aggregator_item_id")
    private String aggregatorItemId;

    @Column(name = "source_language", length = 10)
    private String sourceLanguage;

    @Column(name = "parsed_at")
    private Instant parsedAt;

    // -- Timestamps --

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    // -- Relationships --

    @ManyToMany
    @JoinTable(
            name = "article_tags",
            joinColumns = @JoinColumn(name = "article_id"),
            inverseJoinColumns = @JoinColumn(name = "tag_id"))
    @OrderBy("name")
    private Set<Tag> tags = new HashSet<>();

    @ManyToMany
    @JoinTable(
            name = "related_articles",
            joinColumns = @JoinColumn(name = "article_id"),
            inverseJoinColumns = @JoinColumn(name = "related_article_id"))
    private Set<Article> relatedArticles = new HashSet<>();

    // -- Lifecycle --

    @PrePersist
    void onCreate() {
        var now = Instant.now();
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        if (this.updatedAt == null) {
            this.updatedAt = now;
        }
    }
}
