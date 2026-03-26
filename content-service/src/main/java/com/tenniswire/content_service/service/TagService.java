package com.tenniswire.content_service.service;

import com.tenniswire.content_service.dto.TagResponse;
import com.tenniswire.content_service.dto.editorial.CreateTagRequest;
import com.tenniswire.content_service.dto.editorial.UpdateTagRequest;
import com.tenniswire.content_service.dto.pub.SectionResponse;
import com.tenniswire.content_service.entity.Tag;
import com.tenniswire.content_service.entity.TagType;
import com.tenniswire.content_service.exception.ConflictException;
import com.tenniswire.content_service.exception.ResourceNotFoundException;
import com.tenniswire.content_service.repository.TagRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;
import static com.tenniswire.content_service.repository.TagSpecification.hasType;
import static com.tenniswire.content_service.repository.TagSpecification.nameContains;

@Service
@Transactional
public class TagService {

    private final TagRepository tagRepository;
    private final SlugGenerator slugGenerator;

    public TagService(TagRepository tagRepository, SlugGenerator slugGenerator) {
        this.tagRepository = tagRepository;
        this.slugGenerator = slugGenerator;
    }

    // -- Editorial CRUD --

    public TagResponse create(CreateTagRequest request) {
        var tag = new Tag();
        tag.name(request.name());
        tag.type(TagType.fromValue(request.type()));

        // Slug: use provided or generate from name
        if (request.slug() != null && !request.slug().isBlank()) {
            if (tagRepository.existsBySlug(request.slug())) {
                throw new ConflictException("Tag slug already exists: " + request.slug());
            }
            tag.slug(request.slug());
        } else {
            tag.slug(slugGenerator.generateTagSlug(request.name()));
        }

        // Section-specific fields
        tag.description(request.description());
        tag.icon(request.icon());
        tag.sortOrder(request.sortOrder());

        var saved = tagRepository.save(tag);
        return TagResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public Page<TagResponse> findAllEditorial(TagType type, String search, Pageable pageable) {
        var spec = Specification.where(hasType(type))
            .and(nameContains(search));

        return tagRepository.findAll(spec, pageable).map(TagResponse::from);
    }

    @Transactional(readOnly = true)
    public TagResponse findById(UUID id) {
        return TagResponse.from(findTagOrThrow(id));
    }

    public TagResponse update(UUID id, UpdateTagRequest request) {
        var tag = findTagOrThrow(id);

        if (request.name() != null) {
            tag.name(request.name());
        }
        if (request.slug() != null) {
            if (!request.slug().equals(tag.slug()) && tagRepository.existsBySlug(request.slug())) {
                throw new ConflictException("Tag slug already exists: " + request.slug());
            }
            tag.slug(request.slug());
        }
        if (request.description() != null) {
            tag.description(request.description().isBlank() ? null : request.description());
        }
        if (request.icon() != null) {
            tag.icon(request.icon().isBlank() ? null : request.icon());
        }
        if (request.sortOrder() != null) {
            tag.sortOrder(request.sortOrder());
        }
        if (request.isActive() != null) {
            tag.isActive(request.isActive());
        }

        var saved = tagRepository.save(tag);
        return TagResponse.from(saved);
    }

    public void delete(UUID id) {
        var tag = findTagOrThrow(id);
        if (tagRepository.isTagUsedByArticles(id)) {
            throw new ConflictException("Cannot delete tag that is used by articles: " + tag.name());
        }
        tagRepository.delete(tag);
    }

    // -- Public read-only --

    @Transactional(readOnly = true)
    public List<TagResponse> findByType(TagType type) {
        return tagRepository.findByType(type).stream().map(TagResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public TagResponse findBySlug(String slug) {
        var tag = tagRepository
            .findBySlug(slug)
            .orElseThrow(() -> new ResourceNotFoundException("Tag", slug));
        return TagResponse.from(tag);
    }

    @Transactional(readOnly = true)
    public List<SectionResponse> findActiveSections() {
        return tagRepository.findByTypeAndIsActiveTrueOrderBySortOrder(TagType.SECTION).stream()
            .map(SectionResponse::from)
            .toList();
    }

    // -- Private --

    private Tag findTagOrThrow(UUID id) {
        return tagRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Tag", id));
    }
}
