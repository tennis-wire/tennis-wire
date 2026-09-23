package com.tenniswire.discussion_service.dto.reader;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/** A top-level comment. Replies go through {@link CreateReplyRequest} and inherit the subject. */
public record CreateCommentRequest(
        @NotBlank @Size(max = 100) String subjectType,
        @NotNull UUID subjectId,
        // 2000 by the rules; the schema itself holds more
        @NotBlank @Size(max = 2000) String body) {

    // Before validation: a body of nothing but these is blank
    public CreateCommentRequest {
        body = CommentText.clean(body);
    }
}
