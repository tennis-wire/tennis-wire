package com.tenniswire.discussion_service.dto;

import java.util.List;

public record ModerationQueueResponse(List<QueueEntryResponse> items, int page, int size) {}
