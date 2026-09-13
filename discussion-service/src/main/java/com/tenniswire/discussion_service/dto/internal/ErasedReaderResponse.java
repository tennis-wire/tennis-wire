package com.tenniswire.discussion_service.dto.internal;

import java.time.Instant;
import org.jspecify.annotations.Nullable;

public record ErasedReaderResponse(boolean banned, @Nullable Instant bannedUntil) {}
