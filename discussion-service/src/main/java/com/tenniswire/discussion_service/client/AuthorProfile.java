package com.tenniswire.discussion_service.client;

import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** The public part of a user-service profile, as GET /internal/users returns it. */
public record AuthorProfile(
        UUID id, String displayName, @Nullable String avatarUrl) {}
