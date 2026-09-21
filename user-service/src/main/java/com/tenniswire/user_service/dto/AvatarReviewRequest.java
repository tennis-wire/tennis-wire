package com.tenniswire.user_service.dto;

import jakarta.validation.constraints.NotBlank;

public record AvatarReviewRequest(@NotBlank String avatarKey) {}
