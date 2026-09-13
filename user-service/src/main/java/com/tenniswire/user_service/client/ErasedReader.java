package com.tenniswire.user_service.client;

import java.time.Instant;
import org.jspecify.annotations.Nullable;

public record ErasedReader(boolean banned, @Nullable Instant bannedUntil) {}
