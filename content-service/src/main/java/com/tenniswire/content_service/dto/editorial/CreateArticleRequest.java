package com.tenniswire.content_service.dto.editorial;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Set;
import java.util.UUID;

public record CreateArticleRequest(
    @NotNull String type,
    @NotBlank @Size(max = 500) String title,
    String subtitle,
    @Size(max = 500) String slug,
    String content,
    @Size(max = 2000) String coverImageUrl,
    @Size(max = 2000) String sourceUrl,
    @Size(max = 300) String sourceName,
    Set<UUID> tagIds,
    String aggregatorItemId) {}
