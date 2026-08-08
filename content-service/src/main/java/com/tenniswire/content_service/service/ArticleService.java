package com.tenniswire.content_service.service;

import static com.tenniswire.content_service.repository.ArticleSpecification.hasStatus;
import static com.tenniswire.content_service.repository.ArticleSpecification.hasTag;
import static com.tenniswire.content_service.repository.ArticleSpecification.hasType;
import static com.tenniswire.content_service.repository.ArticleSpecification.titleContains;

import com.tenniswire.content_service.dto.ArticleResponse;
import com.tenniswire.content_service.dto.ArticleSummaryResponse;
import com.tenniswire.content_service.dto.editorial.CreateArticleRequest;
import com.tenniswire.content_service.dto.editorial.PublishResponse;
import com.tenniswire.content_service.dto.editorial.UpdateArticleRequest;
import com.tenniswire.content_service.entity.Article;
import com.tenniswire.content_service.entity.ArticleStatus;
import com.tenniswire.content_service.entity.ArticleType;
import com.tenniswire.content_service.exception.ConflictException;
import com.tenniswire.content_service.exception.PublishValidationException;
import com.tenniswire.content_service.exception.ResourceNotFoundException;
import com.tenniswire.content_service.repository.ArticleRepository;
import com.tenniswire.content_service.repository.TagRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ArticleService {

    private final ArticleRepository articleRepository;
    private final TagRepository tagRepository;
    private final SlugGenerator slugGenerator;

    public ArticleService(
            ArticleRepository articleRepository, TagRepository tagRepository, SlugGenerator slugGenerator) {
        this.articleRepository = articleRepository;
        this.tagRepository = tagRepository;
        this.slugGenerator = slugGenerator;
    }

    // -- Editorial CRUD --

    public ArticleResponse create(CreateArticleRequest request) {
        var article = new Article();
        article.type(ArticleType.fromValue(request.type()));
        article.status(ArticleStatus.DRAFT);
        article.title(request.title());
        article.subtitle(request.subtitle());
        article.content(request.content());
        article.coverImageUrl(request.coverImageUrl());
        article.sourceUrl(request.sourceUrl());
        article.sourceName(request.sourceName());
        article.aggregatorItemId(request.aggregatorItemId());

        // Slug: use provided or generate from title
        if (request.slug() != null && !request.slug().isBlank()) {
            if (articleRepository.existsBySlug(request.slug())) {
                throw new ConflictException("Slug already exists: " + request.slug());
            }
            article.slug(request.slug());
        } else {
            article.slug(slugGenerator.generateArticleSlug(request.title()));
        }

        // Tags
        if (request.tagIds() != null && !request.tagIds().isEmpty()) {
            article.tags(tagRepository.findByIdIn(request.tagIds()));
        }

        // Reading time (auto-calc for articles)
        if (article.type() == ArticleType.ARTICLE && request.content() != null) {
            article.readingTime(calculateReadingTime(request.content()));
        }

        var saved = articleRepository.save(article);
        return ArticleResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public Page<ArticleSummaryResponse> findAllEditorial(
            ArticleType type, ArticleStatus status, String search, Pageable pageable) {
        var spec = Specification.where(hasType(type)).and(hasStatus(status)).and(titleContains(search));

        return articleRepository.findAll(spec, pageable).map(ArticleSummaryResponse::from);
    }

    @Transactional(readOnly = true)
    public ArticleResponse findByIdEditorial(UUID id) {
        var article = findArticleOrThrow(id);
        return ArticleResponse.from(article);
    }

    public ArticleResponse update(UUID id, UpdateArticleRequest request) {
        var article = findArticleOrThrow(id);

        // Partial update: only non-null fields are applied
        if (request.title() != null) {
            article.title(request.title());
        }
        if (request.subtitle() != null) {
            article.subtitle(request.subtitle().isBlank() ? null : request.subtitle());
        }
        if (request.content() != null) {
            article.content(request.content());
            if (article.type() == ArticleType.ARTICLE) {
                article.readingTime(calculateReadingTime(request.content()));
            }
        }
        if (request.coverImageUrl() != null) {
            article.coverImageUrl(request.coverImageUrl().isBlank() ? null : request.coverImageUrl());
        }
        if (request.sourceUrl() != null) {
            article.sourceUrl(request.sourceUrl().isBlank() ? null : request.sourceUrl());
        }
        if (request.sourceName() != null) {
            article.sourceName(request.sourceName().isBlank() ? null : request.sourceName());
        }
        if (request.slug() != null) {
            if (!request.slug().equals(article.slug()) && articleRepository.existsBySlug(request.slug())) {
                throw new ConflictException("Slug already exists: " + request.slug());
            }
            article.slug(request.slug());
        }
        if (request.tagIds() != null) {
            article.tags(
                    request.tagIds().isEmpty() ? Collections.emptySet() : tagRepository.findByIdIn(request.tagIds()));
        }

        var saved = articleRepository.save(article);
        return ArticleResponse.from(saved);
    }

    public void delete(UUID id) {
        var article = findArticleOrThrow(id);
        if (article.status() == ArticleStatus.PUBLISHED) {
            throw new ConflictException("Cannot delete a published article. Unpublish first.");
        }
        articleRepository.delete(article);
    }

    // -- Publish flow --

    public PublishResponse publish(UUID id) {
        var article = findArticleOrThrow(id);
        validateForPublishing(article);

        article.status(ArticleStatus.PUBLISHED);
        article.publishedAt(Instant.now());

        var saved = articleRepository.save(article);
        return PublishResponse.from(saved);
    }

    public ArticleResponse unpublish(UUID id) {
        var article = findArticleOrThrow(id);
        if (article.status() != ArticleStatus.PUBLISHED) {
            throw new ConflictException("Article is not published");
        }

        article.status(ArticleStatus.DRAFT);
        article.publishedAt(null);

        var saved = articleRepository.save(article);
        return ArticleResponse.from(saved);
    }

    // -- Public read-only --

    @Transactional(readOnly = true)
    public Page<ArticleSummaryResponse> findPublished(ArticleType type, Pageable pageable) {
        var spec = Specification.where(hasStatus(ArticleStatus.PUBLISHED)).and(hasType(type));

        return articleRepository.findAll(spec, pageable).map(ArticleSummaryResponse::from);
    }

    @Transactional(readOnly = true)
    public Page<ArticleSummaryResponse> findPublishedByTag(String tagSlug, ArticleType type, Pageable pageable) {
        var spec = Specification.where(hasStatus(ArticleStatus.PUBLISHED))
                .and(hasTag(tagSlug))
                .and(hasType(type));

        return articleRepository.findAll(spec, pageable).map(ArticleSummaryResponse::from);
    }

    @Transactional(readOnly = true)
    public ArticleResponse findPublishedBySlug(String slug) {
        var article = articleRepository
                .findBySlugAndStatus(slug, ArticleStatus.PUBLISHED)
                .orElseThrow(() -> new ResourceNotFoundException("Article", slug));
        return ArticleResponse.from(article);
    }

    // -- Private helpers --

    private Article findArticleOrThrow(UUID id) {
        return articleRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Article", id));
    }

    private void validateForPublishing(Article article) {
        var violations = new ArrayList<PublishValidationException.Violation>();

        if (article.title() == null || article.title().isBlank()) {
            violations.add(new PublishValidationException.Violation("title", "Title is required"));
        }
        if (article.content() == null || article.content().isBlank()) {
            violations.add(new PublishValidationException.Violation("content", "Content is required"));
        }
        if (article.tags() == null || article.tags().isEmpty()) {
            violations.add(new PublishValidationException.Violation("tags", "At least one tag is required"));
        }

        if (article.type() == ArticleType.ARTICLE) {
            if (article.subtitle() == null || article.subtitle().isBlank()) {
                violations.add(
                        new PublishValidationException.Violation("subtitle", "Subtitle is required for articles"));
            }
            if (article.coverImageUrl() == null || article.coverImageUrl().isBlank()) {
                violations.add(new PublishValidationException.Violation(
                        "coverImageUrl", "Cover image is required for articles"));
            }
        }

        if (!violations.isEmpty()) {
            throw new PublishValidationException(violations);
        }
    }

    private int calculateReadingTime(String htmlContent) {
        var text = htmlContent.replaceAll("<[^>]*>", " ").trim();
        var wordCount = text.split("\\s+").length;
        return Math.max(1, (int) Math.ceil(wordCount / 200.0));
    }
}
