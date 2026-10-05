package com.tenniswire.content_service.dto.pub;

import com.tenniswire.content_service.repository.SitemapRow;
import java.time.Instant;

// An article as a sitemap names it: where it is, and since when it is as it is
public record SitemapEntryResponse(String type, String slug, Instant publishedAt, Instant revisedAt) {

    public static SitemapEntryResponse from(SitemapRow row) {
        return new SitemapEntryResponse(row.type().value(), row.slug(), row.publishedAt(), row.revisedAt());
    }
}
