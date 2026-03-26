package com.tenniswire.content_service.dto;

import com.tenniswire.content_service.entity.Article;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ArticleSummaryResponse(
    UUID id,
    String type,
    String status,
    String title,
    String subtitle,
    String slug,
    String coverImageUrl,
    Integer readingTime,
    String sourceUrl,
    String sourceName,
    List<TagResponse> tags,
    Instant publishedAt,
    Instant updatedAt,
    Instant createdAt) {

    public static ArticleSummaryResponse from(Article article) {
        var tags = article.tags().stream()
            .map(TagResponse::compact)
            .sorted((a, b) -> a.name().compareToIgnoreCase(b.name()))
            .toList();

        return new ArticleSummaryResponse(
            article.id(),
            article.type().value(),
            article.status().value(),
            article.title(),
            article.subtitle(),
            article.slug(),
            article.coverImageUrl(),
            article.readingTime(),
            article.sourceUrl(),
            article.sourceName(),
            tags,
            article.publishedAt(),
            article.updatedAt(),
            article.createdAt());
    }
}
