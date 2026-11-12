package com.tenniswire.discussion_service.dto.reader;

import com.tenniswire.discussion_service.service.AuthorReactions;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

public record AuthorCardResponse(
        UUID id,
        String displayName,
        @Nullable String avatarUrl,
        long commentCount,
        long likeCount,
        long dislikeCount,
        Map<String, Long> emojiCounts) {

    public static AuthorCardResponse of(AuthorResponse.Named author, long commentCount, AuthorReactions reactions) {
        return new AuthorCardResponse(
                author.id(),
                author.displayName(),
                author.avatarUrl(),
                commentCount,
                reactions.likeCount(),
                reactions.dislikeCount(),
                reactions.emojiCounts());
    }
}
