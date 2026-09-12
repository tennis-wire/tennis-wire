package com.tenniswire.discussion_service.dto.reader;

public record CommentCreatedResponse(CommentResponse comment, boolean mutedByRecipient) {}
