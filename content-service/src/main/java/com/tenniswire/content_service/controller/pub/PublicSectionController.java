package com.tenniswire.content_service.controller.pub;

import com.tenniswire.content_service.dto.ArticleSummaryResponse;
import com.tenniswire.content_service.dto.pub.SectionResponse;
import com.tenniswire.content_service.entity.ArticleType;
import com.tenniswire.content_service.service.ArticleService;
import com.tenniswire.content_service.service.TagService;
import java.util.List;
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
@RequestMapping("/api/public/sections")
public class PublicSectionController {

    private final TagService tagService;
    private final ArticleService articleService;

    public PublicSectionController(TagService tagService, ArticleService articleService) {
        this.tagService = tagService;
        this.articleService = articleService;
    }

    @GetMapping
    public List<SectionResponse> list() {
        return tagService.findActiveSections();
    }

    @GetMapping("/{slug}/articles")
    public Page<ArticleSummaryResponse> articles(
            @PathVariable String slug,
            @RequestParam(required = false) String type,
            @PageableDefault(size = 20, sort = "publishedAt", direction = Sort.Direction.DESC) Pageable pageable) {
        var articleType = type != null ? ArticleType.fromValue(type) : null;
        return articleService.findPublishedByTag(slug, articleType, pageable);
    }
}
