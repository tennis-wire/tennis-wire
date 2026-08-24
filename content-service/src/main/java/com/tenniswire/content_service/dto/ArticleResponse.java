package com.tenniswire.content_service.dto;

import com.tenniswire.content_service.entity.Article;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ArticleResponse(
        UUID id,
        String type,
        String status,
        String title,
        String subtitle,
        String slug,
        String content,
        String coverImageUrl,
        Integer readingTime,
        String sourceUrl,
        String sourceName,
        UUID authorId,
        List<TagResponse> tags,
        List<RelatedArticleResponse> relatedArticles,
        String aggregatorItemId,
        String sourceLanguage,
        Instant parsedAt,
        Instant publishedAt,
        Instant updatedAt,
        Instant createdAt) {

    public static ArticleResponse from(Article article) {
        var tags = article.tags().stream()
                .map(TagResponse::compact)
                .sorted((a, b) -> a.name().compareToIgnoreCase(b.name()))
                .toList();

        var related = article.relatedArticles().stream()
                .map(RelatedArticleResponse::from)
                .toList();

        return new ArticleResponse(
                article.id(),
                article.type().value(),
                article.status().value(),
                article.title(),
                article.subtitle(),
                article.slug(),
                article.content(),
                article.coverImageUrl(),
                article.readingTime(),
                article.sourceUrl(),
                article.sourceName(),
                article.authorId(),
                tags,
                related,
                article.aggregatorItemId(),
                article.sourceLanguage(),
                article.parsedAt(),
                article.publishedAt(),
                article.updatedAt(),
                article.createdAt());
    }

    // Nested DTO for related articles
    public record RelatedArticleResponse(String title, String slug, String coverImageUrl, String type) {

        public static RelatedArticleResponse from(Article article) {
            return new RelatedArticleResponse(
                    article.title(),
                    article.slug(),
                    article.coverImageUrl(),
                    article.type().value());
        }
    }
}
