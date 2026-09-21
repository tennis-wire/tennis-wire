package com.tenniswire.discussion_service.dto.reader;

import java.util.UUID;
import org.jspecify.annotations.Nullable;

public record AuthorCardResponse(
        UUID id, String displayName, @Nullable String avatarUrl, long commentCount) {}
