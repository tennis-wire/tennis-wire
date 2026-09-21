package com.tenniswire.content_service.controller.pub;

import com.tenniswire.content_service.dto.ArticleResponse;
import com.tenniswire.content_service.dto.ArticleSummaryResponse;
import com.tenniswire.content_service.dto.pub.ArticleRefResponse;
import com.tenniswire.content_service.entity.ArticleType;
import com.tenniswire.content_service.service.ArticleService;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
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

    // A literal, so it wins over /{slug} in Spring's own ordering - and "by-ids" stops being usable
    // as a slug. Order of the result is the database's; the caller matches rows to ids by id.
    @GetMapping("/by-ids")
    public List<ArticleRefResponse> byIds(
            @RequestParam("ids") @NotEmpty @Size(max = ArticleService.MAX_REF_IDS) List<UUID> ids) {
        return articleService.findPublishedByIds(ids);
    }

    @GetMapping("/{slug}")
    public ArticleResponse get(@PathVariable String slug) {
        return articleService.findPublishedBySlug(slug);
    }
}
