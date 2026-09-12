package com.tenniswire.discussion_service.dto.reader;

import jakarta.validation.constraints.NotBlank;

public record CreateReportRequest(@NotBlank String reason) {}
