package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.exception.UnknownSortException;

/**
 * Order of the top-level listing. Replies inside a branch are always oldest first, whichever of
 * these is chosen: a thread read out of order stops being a conversation.
 */
public enum CommentSort {
    NEWEST("newest"),
    OLDEST("oldest"),
    // Ordered by likes minus dislikes, emoji left out of it. The tie-break follows the sort rather
    // than always favouring the newer comment, so that one index serves both read either way.
    TOP("top"),
    BOTTOM("bottom");

    public static final CommentSort DEFAULT = NEWEST;

    private final String value;

    CommentSort(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public boolean byScore() {
        return this == TOP || this == BOTTOM;
    }

    public static CommentSort fromValue(String value) {
        if (value == null || value.isBlank()) {
            return DEFAULT;
        }
        for (var sort : values()) {
            if (sort.value.equals(value)) {
                return sort;
            }
        }
        throw new UnknownSortException(value);
    }
}
