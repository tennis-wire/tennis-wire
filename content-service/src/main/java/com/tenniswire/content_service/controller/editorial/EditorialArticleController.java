package com.tenniswire.content_service.controller.editorial;

import com.tenniswire.content_service.dto.ArticleResponse;
import com.tenniswire.content_service.dto.ArticleSummaryResponse;
import com.tenniswire.content_service.dto.editorial.CreateArticleRequest;
import com.tenniswire.content_service.dto.editorial.PublishResponse;
import com.tenniswire.content_service.dto.editorial.UpdateArticleRequest;
import com.tenniswire.content_service.entity.ArticleStatus;
import com.tenniswire.content_service.entity.ArticleType;
import com.tenniswire.content_service.service.ArticleService;
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
@RequestMapping("/api/editorial/articles")
public class EditorialArticleController {

    private final ArticleService articleService;

    public EditorialArticleController(ArticleService articleService) {
        this.articleService = articleService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ArticleResponse create(@Valid @RequestBody CreateArticleRequest request) {
        return articleService.create(request);
    }

    @GetMapping
    public Page<ArticleSummaryResponse> list(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20, sort = "updatedAt", direction = Sort.Direction.DESC) Pageable pageable) {
        var articleType = type != null ? ArticleType.fromValue(type) : null;
        var articleStatus = status != null ? ArticleStatus.fromValue(status) : null;
        return articleService.findAllEditorial(articleType, articleStatus, search, pageable);
    }

    @GetMapping("/{id}")
    public ArticleResponse get(@PathVariable UUID id) {
        return articleService.findByIdEditorial(id);
    }

    @PatchMapping("/{id}")
    public ArticleResponse update(@PathVariable UUID id, @Valid @RequestBody UpdateArticleRequest request) {
        return articleService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        articleService.delete(id);
    }

    @PostMapping("/{id}/publish")
    public PublishResponse publish(@PathVariable UUID id) {
        return articleService.publish(id);
    }

    @PostMapping("/{id}/unpublish")
    public ArticleResponse unpublish(@PathVariable UUID id) {
        return articleService.unpublish(id);
    }
}
