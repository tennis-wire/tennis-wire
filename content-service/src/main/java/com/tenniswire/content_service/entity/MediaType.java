package com.tenniswire.content_service.entity;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum MediaType {
    IMAGE("image"),
    VIDEO("video"),
    AUDIO("audio");

    private final String value;

    public static MediaType fromValue(String value) {
        for (MediaType type : values()) {
            if (type.value.equals(value)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown media type: " + value);
    }
}
