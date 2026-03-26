package com.tenniswire.content_service.entity;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum ArticleType {
    NEWS("news"),
    ARTICLE("article");

    private final String value;

    public static ArticleType fromValue(String value) {
        for (ArticleType type : values()) {
            if (type.value.equals(value)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown article type: " + value);
    }
}

