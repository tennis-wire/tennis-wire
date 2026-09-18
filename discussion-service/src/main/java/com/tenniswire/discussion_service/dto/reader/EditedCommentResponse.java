package com.tenniswire.discussion_service.dto.reader;

import com.tenniswire.discussion_service.entity.Comment;
import java.time.Instant;
import java.util.UUID;

// Only the fields an edit moves. The client already holds the comment, and keeping the author out
// means an edit never waits on user-service.
public record EditedCommentResponse(UUID id, String body, Instant updatedAt, boolean edited) {

    public static EditedCommentResponse from(Comment comment) {
        return new EditedCommentResponse(comment.id(), comment.body(), comment.updatedAt(), comment.isEdited());
    }
}
