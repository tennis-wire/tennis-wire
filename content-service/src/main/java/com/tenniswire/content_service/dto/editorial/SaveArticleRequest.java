package com.tenniswire.content_service.dto.editorial;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Set;
import java.util.UUID;

// The whole working copy, not a patch: an optional field sent as null is cleared. The one
// exception is slug once the article has been published: it is frozen, and null leaves it be.
public record SaveArticleRequest(
        @NotBlank String version,
        @NotNull String type,
        @NotBlank @Size(max = 500) String title,
        String subtitle,

        @Size(max = 500) @Pattern(regexp = CreateArticleRequest.SLUG_PATTERN) String slug,

        String content,
        @Size(max = 2000) String coverImageUrl,
        @Size(max = 2000) String sourceUrl,
        @Size(max = 300) String sourceName,
        Set<UUID> tagIds) {}
