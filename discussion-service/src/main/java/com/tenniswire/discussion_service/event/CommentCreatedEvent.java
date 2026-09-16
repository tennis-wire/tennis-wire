package com.tenniswire.discussion_service.event;

import java.time.Instant;
import java.util.UUID;

/** {@code comment.created}: what moderation and notifications will consume. */
public record CommentCreatedEvent(
        UUID commentId,
        String subjectType,
        UUID subjectId,
        UUID rootId,
        UUID inReplyToId,
        UUID authorId,
        Instant createdAt) {

    public static final String TYPE = "comment.created";
}
