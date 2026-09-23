package com.tenniswire.content_service.dto.editorial;

import com.tenniswire.content_service.entity.Article;
import java.time.Instant;
import java.util.UUID;

// A row in the caller's own lists: his drafts, and his pending edits of published articles
public record WorkItemResponse(UUID id, String type, String title, boolean wasPublished, Instant updatedAt) {

    public static WorkItemResponse from(Article article) {
        return new WorkItemResponse(
                article.id(),
                article.type().value(),
                article.title(),
                article.firstPublishedAt() != null,
                article.updatedAt());
    }
}
