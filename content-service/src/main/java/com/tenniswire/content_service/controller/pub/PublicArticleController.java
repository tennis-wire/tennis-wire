package com.tenniswire.content_service.controller.pub;

import com.tenniswire.content_service.dto.ArticleResponse;
import com.tenniswire.content_service.dto.ArticleSummaryResponse;
import com.tenniswire.content_service.entity.ArticleType;
import com.tenniswire.content_service.service.ArticleService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/articles")
public class PublicArticleController {

    private final ArticleService articleService;

    public PublicArticleController(ArticleService articleService) {
        this.articleService = articleService;
    }

    @GetMapping
    public Page<ArticleSummaryResponse> list(
        @RequestParam(required = false) String type,
        @RequestParam(required = false) String tag,
        @PageableDefault(size = 20, sort = "publishedAt", direction = Sort.Direction.DESC) Pageable pageable) {
        var articleType = type != null ? ArticleType.fromValue(type) : null;

        if (tag != null) {
            return articleService.findPublishedByTag(tag, articleType, pageable);
        }
        return articleService.findPublished(articleType, pageable);
    }

    @GetMapping("/{slug}")
    public ArticleResponse get(@PathVariable String slug) {
        return articleService.findPublishedBySlug(slug);
    }
}
