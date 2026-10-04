package com.tenniswire.content_service.dto.editorial;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ImageLinkRequest(@NotBlank @Size(max = 2000) String url) {}
