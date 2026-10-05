package com.tenniswire.content_service.repository;

import com.tenniswire.content_service.entity.Article;
import com.tenniswire.content_service.entity.ArticleStatus;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ArticleRepository extends JpaRepository<Article, UUID>, JpaSpecificationExecutor<Article> {

    Optional<Article> findBySlugAndStatus(String slug, ArticleStatus status);

    List<Article> findByIdInAndStatus(Collection<UUID> ids, ArticleStatus status);

    Optional<Article> findBySlug(String slug);

    boolean existsBySlug(String slug);

    boolean existsBySlugAndIdNot(String slug, UUID id);

    // No body, no tags: a sitemap names every article and would otherwise load all of them whole
    @Query("""
            SELECT new com.tenniswire.content_service.repository.SitemapRow(a.type, a.slug, a.publishedAt, a.revisedAt)
            FROM Article a
            WHERE a.status = :status
            ORDER BY a.publishedAt DESC""")
    List<SitemapRow> findSitemapRows(@Param("status") ArticleStatus status, Limit limit);
}
