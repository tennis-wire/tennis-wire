package com.tenniswire.content_service.service;

import static com.tenniswire.content_service.repository.ArticleSpecification.hasStatus;
import static com.tenniswire.content_service.repository.ArticleSpecification.ownedBy;
import static com.tenniswire.content_service.repository.ArticleSpecification.titleContains;

import com.tenniswire.content_service.dto.TagResponse;
import com.tenniswire.content_service.dto.editorial.CreateArticleRequest;
import com.tenniswire.content_service.dto.editorial.EditorialArticleResponse;
import com.tenniswire.content_service.dto.editorial.EditorialArticleResponse.Copy;
import com.tenniswire.content_service.dto.editorial.PublishRequest;
import com.tenniswire.content_service.dto.editorial.SaveArticleRequest;
import com.tenniswire.content_service.dto.editorial.WorkItemResponse;
import com.tenniswire.content_service.entity.Article;
import com.tenniswire.content_service.entity.ArticleEdit;
import com.tenniswire.content_service.entity.ArticleStatus;
import com.tenniswire.content_service.entity.ArticleType;
import com.tenniswire.content_service.entity.Tag;
import com.tenniswire.content_service.exception.ConflictException;
import com.tenniswire.content_service.exception.ForbiddenException;
import com.tenniswire.content_service.exception.PublishValidationException;
import com.tenniswire.content_service.exception.ResourceNotFoundException;
import com.tenniswire.content_service.exception.UnknownTagException;
import com.tenniswire.content_service.repository.ArticleEditRepository;
import com.tenniswire.content_service.repository.ArticleRepository;
import com.tenniswire.content_service.repository.TagRepository;
import com.tenniswire.content_service.security.Staff;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

// Drafts belong to their owner alone. A published article is edited through a pending edit, held by
// one person at a time, and reaches the site only when that edit is applied.
@Service
@Transactional
public class EditorialArticleService {

    private static final String STALE_VERSION = "STALE_VERSION";
    private static final String LOCKED = "LOCKED";
    private static final String HAS_PENDING_EDIT = "HAS_PENDING_EDIT";
    private static final String NO_PENDING_EDIT = "NO_PENDING_EDIT";
    private static final String NOT_PUBLISHED = "NOT_PUBLISHED";
    private static final String WAS_PUBLISHED = "WAS_PUBLISHED";
    private static final String SLUG_TAKEN = "SLUG_TAKEN";
    private static final String FROZEN = "FROZEN";

    private final ArticleRepository articleRepository;
    private final ArticleEditRepository editRepository;
    private final TagRepository tagRepository;
    private final SlugGenerator slugGenerator;
    private final JsonMapper jsonMapper;

    public EditorialArticleService(
            ArticleRepository articleRepository,
            ArticleEditRepository editRepository,
            TagRepository tagRepository,
            SlugGenerator slugGenerator,
            JsonMapper jsonMapper) {
        this.articleRepository = articleRepository;
        this.editRepository = editRepository;
        this.tagRepository = tagRepository;
        this.slugGenerator = slugGenerator;
        this.jsonMapper = jsonMapper;
    }

    // -- The caller's own lists --

    @Transactional(readOnly = true)
    public Page<WorkItemResponse> drafts(Staff staff, String search, Pageable pageable) {
        var spec = Specification.where(ownedBy(staff.id()))
                .and(hasStatus(ArticleStatus.DRAFT))
                .and(titleContains(search));
        return articleRepository.findAll(spec, pageable).map(WorkItemResponse::from);
    }

    @Transactional(readOnly = true)
    public Page<WorkItemResponse> edits(Staff staff, Pageable pageable) {
        var page = editRepository.findByOwnerId(staff.id(), pageable);
        var ids = page.getContent().stream().map(ArticleEdit::articleId).toList();
        var types = new HashMap<UUID, ArticleType>();
        articleRepository.findAllById(ids).forEach(article -> types.put(article.id(), article.type()));
        return page.map(edit -> new WorkItemResponse(
                edit.articleId(),
                types.get(edit.articleId()).value(),
                payloadOf(edit).title(),
                true,
                edit.updatedAt()));
    }

    // -- Reading one --

    @Transactional(readOnly = true)
    public EditorialArticleResponse get(UUID id, Staff staff) {
        return view(findVisible(id, staff), staff);
    }

    // What "open by link" resolves: the caller has the address from the site
    @Transactional(readOnly = true)
    public EditorialArticleResponse getBySlug(String slug, Staff staff) {
        var article =
                articleRepository.findBySlug(slug).orElseThrow(() -> new ResourceNotFoundException("Article", slug));
        return view(requireVisible(article, staff), staff);
    }

    // -- Writing --

    public EditorialArticleResponse create(CreateArticleRequest request, Staff staff) {
        var article = new Article();
        article.type(ArticleType.fromValue(request.type()));
        article.status(ArticleStatus.DRAFT);
        article.authorId(staff.id());
        article.aggregatorItemId(request.aggregatorItemId());
        apply(
                article,
                payload(
                        request.title(),
                        request.subtitle(),
                        request.content(),
                        request.coverImageUrl(),
                        request.sourceUrl(),
                        request.sourceName(),
                        request.tagIds()));
        article.slug(checkedSlug(blankToNull(request.slug()), null));
        return view(articleRepository.saveAndFlush(article), staff);
    }

    public EditorialArticleResponse save(UUID id, SaveArticleRequest request, Staff staff) {
        var article = findVisible(id, staff);
        requireUnfrozen(article, request.type(), blankToNull(request.slug()));
        var fields = payload(
                request.title(),
                request.subtitle(),
                request.content(),
                request.coverImageUrl(),
                request.sourceUrl(),
                request.sourceName(),
                request.tagIds());

        if (article.status() == ArticleStatus.DRAFT) {
            requireVersion(request.version(), versionOf(article));
            article.type(ArticleType.fromValue(request.type()));
            apply(article, fields);
            if (article.firstPublishedAt() == null) {
                article.slug(checkedSlug(blankToNull(request.slug()), article.id()));
            }
            return view(articleRepository.saveAndFlush(article), staff);
        }

        var edit = editRepository.findById(id).orElse(null);
        if (edit == null) {
            requireVersion(request.version(), versionOf(article));
            edit = new ArticleEdit();
            edit.articleId(id);
            edit.ownerId(staff.id());
            edit.ownerName(staff.name());
        } else {
            requireHeldBy(edit, staff);
            requireVersion(request.version(), versionOf(edit));
        }
        // Checked now rather than when the edit is applied, days later
        requireKnownTags(fields.tagIds());
        edit.payload(jsonMapper.writeValueAsString(fields));
        saveEdit(edit);
        return view(article, staff);
    }

    // A draft goes on the site; for a published article, the caller's pending edit does
    public EditorialArticleResponse publish(UUID id, PublishRequest request, Staff staff) {
        var article = findVisible(id, staff);
        if (article.status() == ArticleStatus.DRAFT) {
            requireVersion(request.version(), versionOf(article));
            validateForPublishing(article);
            if (article.slug() == null) {
                article.slug(slugGenerator.generateArticleSlug(article.title()));
            }
            var now = Instant.now();
            article.status(ArticleStatus.PUBLISHED);
            article.publishedAt(now);
            if (article.firstPublishedAt() == null) {
                article.firstPublishedAt(now);
            }
        } else {
            var edit = editRepository
                    .findById(id)
                    .orElseThrow(() -> new ConflictException(NO_PENDING_EDIT, "The article has no pending edit"));
            requireHeldBy(edit, staff);
            requireVersion(request.version(), versionOf(edit));
            // A failed check below rolls this back along with everything else
            apply(article, payloadOf(edit));
            validateForPublishing(article);
            editRepository.delete(edit);
        }
        return view(articleRepository.saveAndFlush(article), staff);
    }

    // The holder drops his own edit; a chief editor may reset anyone's, without seeing it
    public void discardEdit(UUID id, Staff staff) {
        findVisible(id, staff);
        var edit = editRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Edit", id));
        if (!edit.ownerId().equals(staff.id()) && !staff.chiefEditor()) {
            throw new ForbiddenException("Only a chief editor may reset someone else's edit");
        }
        editRepository.delete(edit);
    }

    // Comments hang on the id of anything that has been on the site, so that is never deleted
    public void delete(UUID id, Staff staff) {
        var article = findVisible(id, staff);
        if (article.firstPublishedAt() != null) {
            throw new ConflictException(WAS_PUBLISHED, "An article that has been on the site is not deleted");
        }
        articleRepository.delete(article);
    }

    // Back to its owner as a draft, address and all. Not while someone holds an edit: he would be
    // left editing an article that is no longer on the site.
    public void unpublish(UUID id, Staff staff) {
        if (!staff.chiefEditor()) {
            throw new ForbiddenException("Only a chief editor may unpublish");
        }
        var article = findVisible(id, staff);
        if (article.status() != ArticleStatus.PUBLISHED) {
            throw new ConflictException(NOT_PUBLISHED, "Article is not published");
        }
        if (editRepository.existsById(id)) {
            throw new ConflictException(HAS_PENDING_EDIT, "Apply, drop or reset the pending edit first");
        }
        article.status(ArticleStatus.DRAFT);
        article.publishedAt(null);
        articleRepository.save(article);
    }

    // -- Who sees what --

    private Article findVisible(UUID id, Staff staff) {
        var article = articleRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Article", id));
        return requireVisible(article, staff);
    }

    // Someone else's draft does not exist for the caller. A published article is public anyway,
    // so there the answer is an honest 403.
    private static Article requireVisible(Article article, Staff staff) {
        var own = article.authorId().equals(staff.id());
        if (article.status() == ArticleStatus.DRAFT) {
            if (!own) {
                throw new ResourceNotFoundException("Article", article.id());
            }
        } else if (!own && !staff.chiefEditor()) {
            throw new ForbiddenException("Only the author or a chief editor may edit a published article");
        }
        return article;
    }

    private static void requireHeldBy(ArticleEdit edit, Staff staff) {
        if (!edit.ownerId().equals(staff.id())) {
            throw new ConflictException(LOCKED, "Being edited by " + edit.ownerName());
        }
    }

    private static void requireVersion(String sent, String current) {
        if (!current.equals(sent)) {
            throw new ConflictException(STALE_VERSION, "Saved elsewhere since it was opened");
        }
    }

    // The address has been handed out once the article was on the site
    private static void requireUnfrozen(Article article, String type, String slug) {
        if (article.firstPublishedAt() == null) {
            return;
        }
        var typeChanged = !article.type().value().equals(type);
        var slugChanged = slug != null && !slug.equals(article.slug());
        if (typeChanged || slugChanged) {
            throw new ConflictException(FROZEN, "Type and slug do not change once published");
        }
    }

    // The two tables count versions independently, hence the prefix
    private static String versionOf(Article article) {
        return "a:" + article.version();
    }

    private static String versionOf(ArticleEdit edit) {
        return "e:" + edit.version();
    }

    // -- Building the response --

    private EditorialArticleResponse view(Article article, Staff staff) {
        var edit = article.status() == ArticleStatus.PUBLISHED
                ? editRepository.findById(article.id()).orElse(null)
                : null;
        if (edit == null) {
            return response(article, versionOf(article), copyOf(article), null, null, article.updatedAt());
        }
        if (edit.ownerId().equals(staff.id())) {
            var working = copyOf(payloadOf(edit), article.type());
            return response(article, versionOf(edit), working, copyOf(article), null, edit.updatedAt());
        }
        return response(article, versionOf(article), copyOf(article), null, edit.ownerName(), article.updatedAt());
    }

    private static EditorialArticleResponse response(
            Article article, String version, Copy working, Copy live, String lockedBy, Instant savedAt) {
        return new EditorialArticleResponse(
                article.id(),
                article.type().value(),
                article.status().value(),
                article.slug(),
                version,
                working,
                live,
                lockedBy,
                article.aggregatorItemId(),
                article.publishedAt(),
                article.firstPublishedAt(),
                savedAt,
                article.createdAt());
    }

    private static Copy copyOf(Article article) {
        return new Copy(
                article.title(),
                article.subtitle(),
                article.content(),
                article.coverImageUrl(),
                article.readingTime(),
                article.sourceUrl(),
                article.sourceName(),
                tagsOf(article.tags()));
    }

    // Tags deleted since the edit was saved simply drop out here; applying the edit reports them
    private Copy copyOf(EditPayload fields, ArticleType type) {
        Collection<Tag> tags = fields.tagIds().isEmpty() ? List.of() : tagRepository.findByIdIn(fields.tagIds());
        return new Copy(
                fields.title(),
                fields.subtitle(),
                fields.content(),
                fields.coverImageUrl(),
                readingTime(type, fields.content()),
                fields.sourceUrl(),
                fields.sourceName(),
                tagsOf(tags));
    }

    private static List<TagResponse> tagsOf(Collection<Tag> tags) {
        return tags.stream()
                .map(TagResponse::compact)
                .sorted((a, b) -> a.name().compareToIgnoreCase(b.name()))
                .toList();
    }

    // -- Fields --

    private static EditPayload payload(
            String title,
            String subtitle,
            String content,
            String coverImageUrl,
            String sourceUrl,
            String sourceName,
            Set<UUID> tagIds) {
        return new EditPayload(
                title,
                blankToNull(subtitle),
                content,
                blankToNull(coverImageUrl),
                blankToNull(sourceUrl),
                blankToNull(sourceName),
                tagIds == null ? List.of() : List.copyOf(tagIds));
    }

    private EditPayload payloadOf(ArticleEdit edit) {
        return jsonMapper.readValue(edit.payload(), EditPayload.class);
    }

    private void apply(Article article, EditPayload fields) {
        article.title(fields.title());
        article.subtitle(fields.subtitle());
        article.content(fields.content());
        article.coverImageUrl(fields.coverImageUrl());
        article.sourceUrl(fields.sourceUrl());
        article.sourceName(fields.sourceName());
        article.tags(resolveTags(fields.tagIds()));
        article.readingTime(readingTime(article.type(), fields.content()));
    }

    private Set<Tag> resolveTags(List<UUID> ids) {
        if (ids.isEmpty()) {
            return new HashSet<>();
        }
        var found = tagRepository.findByIdIn(ids);
        requireAllFound(ids, found);
        return found;
    }

    private void requireKnownTags(List<UUID> ids) {
        if (!ids.isEmpty()) {
            requireAllFound(ids, tagRepository.findByIdIn(ids));
        }
    }

    private static void requireAllFound(List<UUID> ids, Set<Tag> found) {
        var known = new HashSet<UUID>();
        found.forEach(tag -> known.add(tag.id()));
        var missing = ids.stream().filter(id -> !known.contains(id)).distinct().toList();
        if (!missing.isEmpty()) {
            throw new UnknownTagException(missing);
        }
    }

    // Set by hand on a draft. None means one is made from the title at publication.
    private String checkedSlug(String slug, UUID self) {
        if (slug == null) {
            return null;
        }
        var taken = self == null
                ? articleRepository.existsBySlug(slug)
                : articleRepository.existsBySlugAndIdNot(slug, self);
        if (taken) {
            throw new ConflictException(SLUG_TAKEN, "Slug already exists: " + slug);
        }
        return slug;
    }

    private void saveEdit(ArticleEdit edit) {
        try {
            editRepository.saveAndFlush(edit);
        } catch (DataIntegrityViolationException e) {
            // two first saves at once: the other one got the primary key
            throw new ConflictException(LOCKED, "Someone else has just started editing this article");
        }
    }

    private void validateForPublishing(Article article) {
        var violations = new ArrayList<PublishValidationException.Violation>();

        if (article.title() == null || article.title().isBlank()) {
            violations.add(new PublishValidationException.Violation("title", "Title is required"));
        }
        if (article.content() == null || article.content().isBlank()) {
            violations.add(new PublishValidationException.Violation("content", "Content is required"));
        }
        if (article.tags().isEmpty()) {
            violations.add(new PublishValidationException.Violation("tags", "At least one tag is required"));
        }
        if (article.slug() == null
                && article.title() != null
                && slugGenerator.transliterate(article.title()).isEmpty()) {
            violations.add(new PublishValidationException.Violation(
                    "slug", "No slug can be made from this title; set one by hand"));
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

    private static Integer readingTime(ArticleType type, String content) {
        if (type != ArticleType.ARTICLE || content == null) {
            return null;
        }
        var text = content.replaceAll("<[^>]*>", " ").trim();
        var wordCount = text.split("\\s+").length;
        return Math.max(1, (int) Math.ceil(wordCount / 200.0));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
