package com.tenniswire.content_service.controller.pub;

import com.tenniswire.content_service.dto.ArticleSummaryResponse;
import com.tenniswire.content_service.dto.TagResponse;
import com.tenniswire.content_service.entity.ArticleType;
import com.tenniswire.content_service.entity.TagType;
import com.tenniswire.content_service.service.ArticleService;
import com.tenniswire.content_service.service.TagService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@RestController
@RequestMapping("/api/public/tags")
public class PublicTagController {

    private final TagService tagService;
    private final ArticleService articleService;

    public PublicTagController(TagService tagService, ArticleService articleService) {
        this.tagService = tagService;
        this.articleService = articleService;
    }

    @GetMapping
    public List<TagResponse> list(@RequestParam(required = false) String type) {
        var tagType = type != null ? TagType.fromValue(type) : null;
        if (tagType != null) {
            return tagService.findByType(tagType);
        }
        return tagService.findByType(null);
    }

    @GetMapping("/{slug}")
    public TagWithArticlesResponse get(
        @PathVariable String slug,
        @RequestParam(required = false) String type,
        @PageableDefault(size = 20, sort = "publishedAt", direction = Sort.Direction.DESC) Pageable pageable) {
        var tag = tagService.findBySlug(slug);
        var articleType = type != null ? ArticleType.fromValue(type) : null;
        var articles = articleService.findPublishedByTag(slug, articleType, pageable);
        return new TagWithArticlesResponse(tag, articles);
    }

    // Inline response combining tag + its articles
    public record TagWithArticlesResponse(TagResponse tag, Page<ArticleSummaryResponse> articles) {}
}
