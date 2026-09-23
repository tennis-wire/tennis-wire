package com.tenniswire.content_service.dto.editorial;

import jakarta.validation.constraints.NotBlank;

// The version of the working copy the caller saw: what goes on the site is exactly that
public record PublishRequest(@NotBlank String version) {}
