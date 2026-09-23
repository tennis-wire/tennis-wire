package com.tenniswire.content_service.controller.editorial;

import com.tenniswire.content_service.dto.editorial.CreateArticleRequest;
import com.tenniswire.content_service.dto.editorial.EditorialArticleResponse;
import com.tenniswire.content_service.dto.editorial.PublishRequest;
import com.tenniswire.content_service.dto.editorial.SaveArticleRequest;
import com.tenniswire.content_service.dto.editorial.WorkItemResponse;
import com.tenniswire.content_service.security.Staff;
import com.tenniswire.content_service.service.EditorialArticleService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/editorial/articles")
public class EditorialArticleController {

    private final EditorialArticleService articleService;

    public EditorialArticleController(EditorialArticleService articleService) {
        this.articleService = articleService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EditorialArticleResponse create(
            @Valid @RequestBody CreateArticleRequest request, JwtAuthenticationToken token) {
        return articleService.create(request, Staff.of(token));
    }

    // The caller's own drafts; nobody else's are listed, to anyone
    @GetMapping
    public Page<WorkItemResponse> drafts(
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20, sort = "updatedAt", direction = Sort.Direction.DESC) Pageable pageable,
            JwtAuthenticationToken token) {
        return articleService.drafts(Staff.of(token), search, pageable);
    }

    // The caller's pending edits of published articles. A literal, so it wins over /{id}.
    @GetMapping("/edits")
    public Page<WorkItemResponse> edits(
            @PageableDefault(size = 20, sort = "updatedAt", direction = Sort.Direction.DESC) Pageable pageable,
            JwtAuthenticationToken token) {
        return articleService.edits(Staff.of(token), pageable);
    }

    @GetMapping("/by-slug/{slug}")
    public EditorialArticleResponse getBySlug(@PathVariable String slug, JwtAuthenticationToken token) {
        return articleService.getBySlug(slug, Staff.of(token));
    }

    @GetMapping("/{id}")
    public EditorialArticleResponse get(@PathVariable UUID id, JwtAuthenticationToken token) {
        return articleService.get(id, Staff.of(token));
    }

    @PutMapping("/{id}")
    public EditorialArticleResponse save(
            @PathVariable UUID id, @Valid @RequestBody SaveArticleRequest request, JwtAuthenticationToken token) {
        return articleService.save(id, request, Staff.of(token));
    }

    @PostMapping("/{id}/publish")
    public EditorialArticleResponse publish(
            @PathVariable UUID id, @Valid @RequestBody PublishRequest request, JwtAuthenticationToken token) {
        return articleService.publish(id, request, Staff.of(token));
    }

    @DeleteMapping("/{id}/edit")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void discardEdit(@PathVariable UUID id, JwtAuthenticationToken token) {
        articleService.discardEdit(id, Staff.of(token));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, JwtAuthenticationToken token) {
        articleService.delete(id, Staff.of(token));
    }

    // 204 rather than the article: it becomes its owner's draft, which the caller may not see
    @PostMapping("/{id}/unpublish")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unpublish(@PathVariable UUID id, JwtAuthenticationToken token) {
        articleService.unpublish(id, Staff.of(token));
    }
}
