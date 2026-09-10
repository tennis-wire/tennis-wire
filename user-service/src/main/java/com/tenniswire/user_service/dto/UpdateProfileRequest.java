package com.tenniswire.user_service.dto;

import com.tenniswire.user_service.service.DisplayNames;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record UpdateProfileRequest(
        @NotBlank @Pattern(
                regexp = DisplayNames.PATTERN,
                message = "must be 3-24 characters of letters, digits, underscore or hyphen")
        String displayName) {}
