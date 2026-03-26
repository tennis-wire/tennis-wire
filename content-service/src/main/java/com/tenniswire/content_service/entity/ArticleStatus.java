package com.tenniswire.content_service.entity;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum ArticleStatus {
    DRAFT("draft"),
    PUBLISHED("published");

    private final String value;

    public static ArticleStatus fromValue(String value) {
        for (ArticleStatus status : values()) {
            if (status.value.equals(value)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown article status: " + value);
    }
}
