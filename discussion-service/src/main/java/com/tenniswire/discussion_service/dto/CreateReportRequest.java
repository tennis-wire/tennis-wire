package com.tenniswire.discussion_service.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateReportRequest(@NotBlank String reason) {}
