package com.tenniswire.content_service.entity;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum TagType {
    PLAYER("player"),
    TOURNAMENT("tournament"),
    ORGANIZATION("organization"),
    TOPIC("topic"),
    SECTION("section");

    private final String value;

    public static TagType fromValue(String value) {
        for (TagType type : values()) {
            if (type.value.equals(value)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown tag type: " + value);
    }
}
