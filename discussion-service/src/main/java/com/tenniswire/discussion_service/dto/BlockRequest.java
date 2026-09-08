package com.tenniswire.discussion_service.dto;

import jakarta.validation.constraints.NotBlank;

/** @param mode one of {@code soft}, {@code gravestone}, {@code subtree_removal}; there is no default */
public record BlockRequest(@NotBlank String mode) {}
