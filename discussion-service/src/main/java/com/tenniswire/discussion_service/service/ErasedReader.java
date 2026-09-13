package com.tenniswire.discussion_service.service;

import java.time.Instant;
import org.jspecify.annotations.Nullable;

public record ErasedReader(boolean banned, @Nullable Instant bannedUntil) {}
