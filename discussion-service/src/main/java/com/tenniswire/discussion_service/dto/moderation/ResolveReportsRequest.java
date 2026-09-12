package com.tenniswire.discussion_service.dto.moderation;

import jakarta.validation.constraints.NotBlank;

public record ResolveReportsRequest(@NotBlank String resolution) {}
