package com.tenniswire.discussion_service.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record BotReportRequest(
        @NotNull UUID commentId, @NotBlank String reason) {}
