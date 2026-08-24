package com.tenniswire.editorial_bff.translate.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Translation request from the editorial frontend.
 *
 * @param text       text or HTML to translate
 * @param sourceLang source language code (ISO 639-1), null for auto-detect
 * @param targetLang target language code (required), e.g. "RU", "EN-US", "DE"
 */
public record TranslateRequest(
        @NotBlank String text, String sourceLang, @NotBlank String targetLang) {}
