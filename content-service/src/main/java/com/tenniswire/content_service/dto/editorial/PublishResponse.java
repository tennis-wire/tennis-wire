package com.tenniswire.content_service.dto.editorial;

import com.tenniswire.content_service.entity.Article;
import java.time.Instant;
import java.util.UUID;

public record PublishResponse(UUID id, String status, String slug, Instant publishedAt) {

    public static PublishResponse from(Article article) {
        return new PublishResponse(article.id(), article.status().value(), article.slug(), article.publishedAt());
    }
}
