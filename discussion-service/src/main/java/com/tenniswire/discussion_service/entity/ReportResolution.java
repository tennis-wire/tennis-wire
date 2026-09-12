package com.tenniswire.discussion_service.entity;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum ReportResolution {
    // The comment was removed by moderation, and every report on it closes with it
    HIDDEN("hidden"),
    // The comment stands, and does not return to the queue until it is edited
    DISMISSED("dismissed"),
    // Its author had already deleted it; the violation is counted against him anyway
    COUNTED("counted"),
    // The author erased his account: there is no longer anything to judge
    VOIDED("voided");

    private final String value;

    public static ReportResolution fromValue(String value) {
        for (ReportResolution resolution : values()) {
            if (resolution.value.equals(value)) {
                return resolution;
            }
        }
        throw new IllegalArgumentException("Unknown report resolution: " + value);
    }
}
