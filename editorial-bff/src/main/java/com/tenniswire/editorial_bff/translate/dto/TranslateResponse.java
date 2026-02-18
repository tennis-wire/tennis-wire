package com.tenniswire.editorial_bff.translate.dto;

/**
 * Translation result returned to the frontend.
 *
 * @param text                   translated text (with preserved HTML formatting)
 * @param detectedSourceLanguage detected source language code (e.g. "EN", "DE")
 */
public record TranslateResponse(
    String text,
    String detectedSourceLanguage) {}
