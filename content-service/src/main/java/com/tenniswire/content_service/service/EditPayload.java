package com.tenniswire.content_service.service;

import java.util.List;
import java.util.UUID;

// The fields a save carries, whether they land on the article or wait in its pending edit, where
// they are kept in this shape as json. Blank optional fields arrive here already as null.
public record EditPayload(
        String title,
        String subtitle,
        String content,
        String coverImageUrl,
        String sourceUrl,
        String sourceName,
        List<UUID> tagIds) {

    public EditPayload {
        tagIds = tagIds == null ? List.of() : List.copyOf(tagIds);
    }
}
