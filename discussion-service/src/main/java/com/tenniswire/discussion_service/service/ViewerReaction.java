package com.tenniswire.discussion_service.service;

import org.jspecify.annotations.Nullable;

/** What one viewer has on one comment. Either slot may be empty, and both usually are. */
public record ViewerReaction(
        @Nullable String vote, @Nullable String emoji) {

    public static final ViewerReaction NONE = new ViewerReaction(null, null);
}
