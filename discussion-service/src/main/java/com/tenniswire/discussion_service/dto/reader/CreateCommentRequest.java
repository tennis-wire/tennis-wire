package com.tenniswire.discussion_service.dto.reader;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/** A top-level comment. Replies go through {@link CreateReplyRequest} and inherit the subject. */
public record CreateCommentRequest(
        @NotBlank @Size(max = 100) String subjectType,
        @NotNull UUID subjectId,
        @NotBlank @Size(max = 10_000) String body) {}
