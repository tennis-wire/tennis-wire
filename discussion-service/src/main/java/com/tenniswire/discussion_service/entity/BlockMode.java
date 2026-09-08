package com.tenniswire.discussion_service.entity;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/** How the blocker sees the blocked author's comments. Chosen at block time, see the spec §7. */
@Getter
@RequiredArgsConstructor
public enum BlockMode {
    /** Collapsed behind a placeholder with an "expand" control; children stay visible. */
    SOFT("soft"),
    /** "Comment hidden", no way to expand; children stay visible. */
    GRAVESTONE("gravestone"),
    /** The comment and its whole subtree disappear. */
    SUBTREE_REMOVAL("subtree_removal");

    private final String value;

    public static BlockMode fromValue(String value) {
        for (BlockMode mode : values()) {
            if (mode.value.equals(value)) {
                return mode;
            }
        }
        throw new IllegalArgumentException("Unknown block mode: " + value);
    }
}
