package com.tenniswire.discussion_service.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateReplyRequest(
        @NotBlank @Size(max = 10_000) String body) {}
