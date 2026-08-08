package com.tenniswire.content_service.dto.editorial;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateTagRequest(
        @NotBlank @Size(max = 200) String name,
        @Size(max = 200) String slug,
        @NotNull String type,
        String description,
        @Size(max = 100) String icon,
        Integer sortOrder) {}
