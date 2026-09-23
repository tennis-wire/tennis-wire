package com.tenniswire.content_service.service;

import static com.tenniswire.content_service.repository.ArticleSpecification.hasStatus;
import static com.tenniswire.content_service.repository.ArticleSpecification.hasTag;
import static com.tenniswire.content_service.repository.ArticleSpecification.hasType;

import com.tenniswire.content_service.dto.ArticleResponse;
import com.tenniswire.content_service.dto.ArticleSummaryResponse;
import com.tenniswire.content_service.dto.pub.ArticleRefResponse;
import com.tenniswire.content_service.entity.ArticleStatus;
import com.tenniswire.content_service.entity.ArticleType;
import com.tenniswire.content_service.exception.ResourceNotFoundException;
import com.tenniswire.content_service.repository.ArticleRepository;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// What the site reads. The editorial side is EditorialArticleService.
@Service
@Transactional(readOnly = true)
public class ArticleService {

    // Held well under the request line the gateway accepts: every id spends 37 bytes of it.
    public static final int MAX_REF_IDS = 100;

    private final ArticleRepository articleRepository;

    public ArticleService(ArticleRepository articleRepository) {
        this.articleRepository = articleRepository;
    }

    public Page<ArticleSummaryResponse> findPublished(ArticleType type, Pageable pageable) {
        var spec = Specification.where(hasStatus(ArticleStatus.PUBLISHED)).and(hasType(type));

        return articleRepository.findAll(spec, pageable).map(ArticleSummaryResponse::from);
    }

    public Page<ArticleSummaryResponse> findPublishedByTag(String tagSlug, ArticleType type, Pageable pageable) {
        var spec = Specification.where(hasStatus(ArticleStatus.PUBLISHED))
                .and(hasTag(tagSlug))
                .and(hasType(type));

        return articleRepository.findAll(spec, pageable).map(ArticleSummaryResponse::from);
    }

    // Ids the caller already holds, resolved to enough to name and link each article. Published
    // only: one pulled back from the site is gone for the reader who linked to it.
    public List<ArticleRefResponse> findPublishedByIds(Collection<UUID> ids) {
        if (ids.size() > MAX_REF_IDS) {
            throw new IllegalArgumentException("at most %d ids per lookup, got %d".formatted(MAX_REF_IDS, ids.size()));
        }
        return articleRepository.findByIdInAndStatus(ids, ArticleStatus.PUBLISHED).stream()
                .map(ArticleRefResponse::from)
                .toList();
    }

    public ArticleResponse findPublishedBySlug(String slug) {
        var article = articleRepository
                .findBySlugAndStatus(slug, ArticleStatus.PUBLISHED)
                .orElseThrow(() -> new ResourceNotFoundException("Article", slug));
        return ArticleResponse.from(article);
    }
}
