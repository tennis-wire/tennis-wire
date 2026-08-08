package com.tenniswire.content_service.dto;

import com.tenniswire.content_service.entity.Tag;
import java.time.Instant;
import java.util.UUID;

public record TagResponse(
        UUID id,
        String name,
        String slug,
        String type,
        String description,
        String icon,
        Integer sortOrder,
        Boolean isActive,
        Instant createdAt) {

    // Full tag details
    public static TagResponse from(Tag tag) {
        return new TagResponse(
                tag.id(),
                tag.name(),
                tag.slug(),
                tag.type().value(),
                tag.description(),
                tag.icon(),
                tag.sortOrder(),
                tag.isActive(),
                tag.createdAt());
    }

    // Compact version for article listings (no section-specific fields)
    public static TagResponse compact(Tag tag) {
        return new TagResponse(tag.id(), tag.name(), tag.slug(), tag.type().value(), null, null, null, null, null);
    }
}
