package com.tenniswire.discussion_service.dto.reader;

import com.tenniswire.discussion_service.service.AuthorReactions;
import java.util.Map;

// The count, and what the comments have collected: the cabinet reads both off one call
public record CommentCountResponse(long count, long likeCount, long dislikeCount, Map<String, Long> emojiCounts) {

    public static CommentCountResponse of(long count, AuthorReactions reactions) {
        return new CommentCountResponse(
                count, reactions.likeCount(), reactions.dislikeCount(), reactions.emojiCounts());
    }
}
