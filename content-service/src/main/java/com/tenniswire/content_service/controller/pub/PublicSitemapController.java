package com.tenniswire.content_service.controller.pub;

import com.tenniswire.content_service.dto.pub.SitemapEntryResponse;
import com.tenniswire.content_service.service.ArticleService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// For the site's sitemap.xml. Not under /articles: a literal there would take a slug away, as
// "by-ids" does.
@RestController
@RequestMapping("/api/public/sitemap")
public class PublicSitemapController {

    private final ArticleService articleService;

    public PublicSitemapController(ArticleService articleService) {
        this.articleService = articleService;
    }

    @GetMapping("/articles")
    public List<SitemapEntryResponse> articles() {
        return articleService.findSitemap();
    }
}
