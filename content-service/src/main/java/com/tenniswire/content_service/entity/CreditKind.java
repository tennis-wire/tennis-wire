package com.tenniswire.content_service.entity;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

// What a picture's credit names. The site puts the word before it, so the API carries no label.
@Getter
@RequiredArgsConstructor
public enum CreditKind {
    PHOTO("photo"),
    ILLUSTRATION("illustration"),
    SCREENSHOT("screenshot");

    private final String value;

    public static CreditKind fromValue(String value) {
        for (CreditKind kind : values()) {
            if (kind.value.equals(value)) {
                return kind;
            }
        }
        throw new IllegalArgumentException("Unknown credit kind: " + value);
    }
}
