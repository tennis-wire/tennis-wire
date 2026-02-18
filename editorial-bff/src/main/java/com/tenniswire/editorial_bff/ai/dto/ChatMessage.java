package com.tenniswire.editorial_bff.ai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record ChatMessage(
    @NotBlank @Pattern(regexp = "user|assistant") String role,
    @NotBlank String content) {}
