package com.tenniswire.content_service.repository;

import com.tenniswire.content_service.entity.Article;
import com.tenniswire.content_service.entity.ArticleStatus;
import com.tenniswire.content_service.entity.ArticleType;
import org.springframework.data.jpa.domain.Specification;

public final class ArticleSpecification {

    private ArticleSpecification() {}

    public static Specification<Article> hasType(ArticleType type) {
        return (root, query, cb) -> type == null ? null : cb.equal(root.get("type"), type);
    }

    public static Specification<Article> hasStatus(ArticleStatus status) {
        return (root, query, cb) -> status == null ? null : cb.equal(root.get("status"), status);
    }

    public static Specification<Article> titleContains(String search) {
        return (root, query, cb) -> search == null || search.isBlank()
                ? null
                : cb.like(cb.lower(root.get("title")), "%" + search.toLowerCase() + "%");
    }

    public static Specification<Article> hasTag(String tagSlug) {
        return (root, query, cb) -> {
            if (tagSlug == null) {
                return null;
            }
            var tags = root.join("tags");
            return cb.equal(tags.get("slug"), tagSlug);
        };
    }
}
