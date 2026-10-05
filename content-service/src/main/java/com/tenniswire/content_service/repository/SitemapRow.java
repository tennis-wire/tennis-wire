package com.tenniswire.content_service.repository;

import com.tenniswire.content_service.entity.ArticleType;
import java.time.Instant;

public record SitemapRow(ArticleType type, String slug, Instant publishedAt, Instant revisedAt) {}
