package com.tenniswire.content_service.dto;

import com.tenniswire.content_service.entity.Article;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

// What the site renders. No author id: that is a staff member's Keycloak subject.
public record ArticleResponse(
        UUID id,
        String type,
        String status,
        String title,
        String subtitle,
        String slug,
        String content,
        String coverImageUrl,
        String coverAlt,
        String coverCaption,
        String coverCredit,
        String coverCreditKind,
        Integer readingTime,
        String sourceUrl,
        String sourceName,
        List<TagResponse> tags,
        List<RelatedArticleResponse> relatedArticles,
        String aggregatorItemId,
        String sourceLanguage,
        Instant parsedAt,
        Instant publishedAt,
        // set once an edit has gone on the site after publication
        Instant revisedAt,
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
                article.coverAlt(),
                article.coverCaption(),
                article.coverCredit(),
                article.coverCreditKind() == null
                        ? null
                        : article.coverCreditKind().value(),
                article.readingTime(),
                article.sourceUrl(),
                article.sourceName(),
                tags,
                related,
                article.aggregatorItemId(),
                article.sourceLanguage(),
                article.parsedAt(),
                article.publishedAt(),
                article.revisedAt(),
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
