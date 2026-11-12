package com.tenniswire.discussion_service.service;

import java.util.Map;

// What an author has collected, as of the last fold. Only the emoji keys he has any of.
public record AuthorReactions(long likeCount, long dislikeCount, Map<String, Long> emojiCounts) {

    public static final AuthorReactions NONE = new AuthorReactions(0, 0, Map.of());
}
