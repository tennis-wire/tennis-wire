package com.tenniswire.discussion_service.dto;

public record CommentCreatedResponse(CommentResponse comment, boolean mutedByRecipient) {}
