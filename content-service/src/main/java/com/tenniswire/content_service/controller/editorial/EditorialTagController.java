package com.tenniswire.content_service.controller.editorial;

import com.tenniswire.content_service.dto.TagResponse;
import com.tenniswire.content_service.dto.editorial.CreateTagRequest;
import com.tenniswire.content_service.dto.editorial.UpdateTagRequest;
import com.tenniswire.content_service.entity.TagType;
import com.tenniswire.content_service.service.TagService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/editorial/tags")
public class EditorialTagController {

    private final TagService tagService;

    public EditorialTagController(TagService tagService) {
        this.tagService = tagService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TagResponse create(@Valid @RequestBody CreateTagRequest request) {
        return tagService.create(request);
    }

    @GetMapping
    public Page<TagResponse> list(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String search,
            @PageableDefault(size = 50, sort = "name", direction = Sort.Direction.ASC) Pageable pageable) {
        var tagType = type != null ? TagType.fromValue(type) : null;
        return tagService.findAllEditorial(tagType, search, pageable);
    }

    @GetMapping("/{id}")
    public TagResponse get(@PathVariable UUID id) {
        return tagService.findById(id);
    }

    @PatchMapping("/{id}")
    public TagResponse update(@PathVariable UUID id, @Valid @RequestBody UpdateTagRequest request) {
        return tagService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        tagService.delete(id);
    }
}
