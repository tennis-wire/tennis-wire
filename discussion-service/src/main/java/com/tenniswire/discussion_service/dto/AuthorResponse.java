package com.tenniswire.discussion_service.dto;

import com.tenniswire.discussion_service.client.AuthorProfile;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

public sealed interface AuthorResponse {

    UUID id();

    static AuthorResponse named(AuthorProfile profile) {
        return new Named(profile.id(), profile.displayName(), profile.avatarUrl());
    }

    static AuthorResponse restricted(UUID id) {
        return new Restricted(id, true);
    }

    record Named(UUID id, String displayName, @Nullable String avatarUrl) implements AuthorResponse {}

    record Restricted(UUID id, boolean restricted) implements AuthorResponse {}
}
