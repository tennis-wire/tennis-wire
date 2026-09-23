package com.tenniswire.discussion_service.dto.reader;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// Same bounds as a new comment. Blank is not a way to delete: that is what DELETE is for.
public record EditCommentRequest(@NotBlank @Size(max = 2000) String body) {

    public EditCommentRequest {
        body = CommentText.clean(body);
    }
}
