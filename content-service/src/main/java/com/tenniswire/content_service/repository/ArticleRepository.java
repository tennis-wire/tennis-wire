package com.tenniswire.content_service.repository;

import com.tenniswire.content_service.entity.Article;
import com.tenniswire.content_service.entity.ArticleStatus;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface ArticleRepository extends JpaRepository<Article, UUID>, JpaSpecificationExecutor<Article> {

    Optional<Article> findBySlugAndStatus(String slug, ArticleStatus status);

    List<Article> findByIdInAndStatus(Collection<UUID> ids, ArticleStatus status);

    Optional<Article> findBySlug(String slug);

    boolean existsBySlug(String slug);

    boolean existsBySlugAndIdNot(String slug, UUID id);
}
