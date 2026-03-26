package com.tenniswire.content_service.dto.editorial;

import jakarta.validation.constraints.Size;
import java.util.Set;
import java.util.UUID;

// All fields nullable: null = don't change, present = update.
// To clear an optional field, send empty string (mapped to null in service).
public record UpdateArticleRequest(
    @Size(max = 500) String title,
    String subtitle,
    @Size(max = 500) String slug,
    String content,
    @Size(max = 2000) String coverImageUrl,
    @Size(max = 2000) String sourceUrl,
    @Size(max = 300) String sourceName,
    Set<UUID> tagIds) {}
