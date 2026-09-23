package com.tenniswire.content_service.dto.editorial;

import com.tenniswire.content_service.dto.TagResponse;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

// An article as the editor opens it. working is what the editor shows and saves. live is set only
// while the caller holds a pending edit, for comparing with the site. lockedBy is set while someone
// else holds one: then working is the live text and the article is read-only for the caller.
// version belongs to working and goes back with the next save or publish.
public record EditorialArticleResponse(
        UUID id,
        String type,
        String status,
        String slug,
        String version,
        Copy working,
        Copy live,
        String lockedBy,
        String aggregatorItemId,
        Instant publishedAt,
        Instant firstPublishedAt,
        Instant updatedAt,
        Instant createdAt) {

    public record Copy(
            String title,
            String subtitle,
            String content,
            String coverImageUrl,
            Integer readingTime,
            String sourceUrl,
            String sourceName,
            List<TagResponse> tags) {}
}
