package com.tenniswire.content_service.dto.editorial;

import jakarta.validation.constraints.Size;

public record UpdateTagRequest(
    @Size(max = 200) String name,
    @Size(max = 200) String slug,
    String description,
    @Size(max = 100) String icon,
    Integer sortOrder,
    Boolean isActive) {}
