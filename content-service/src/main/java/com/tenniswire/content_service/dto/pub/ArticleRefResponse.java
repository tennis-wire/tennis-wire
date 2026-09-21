package com.tenniswire.content_service.dto.pub;

import com.tenniswire.content_service.entity.Article;
import java.util.UUID;

// What it takes to name the article a comment stands under and link to it: no tags, no body, no cover.
public record ArticleRefResponse(UUID id, String type, String slug, String title) {

    public static ArticleRefResponse from(Article article) {
        return new ArticleRefResponse(article.id(), article.type().value(), article.slug(), article.title());
    }
}
