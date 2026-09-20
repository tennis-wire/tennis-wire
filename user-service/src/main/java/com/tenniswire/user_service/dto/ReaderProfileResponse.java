package com.tenniswire.user_service.dto;

import com.tenniswire.user_service.entity.Profile;
import edu.umd.cs.findbugs.annotations.Nullable;
import java.time.Instant;
import java.util.UUID;

public record ReaderProfileResponse(
        UUID id, String displayName, @Nullable String avatarUrl, Instant createdAt) {

    public static ReaderProfileResponse from(Profile profile) {
        return new ReaderProfileResponse(profile.userId(), profile.displayName(), null, profile.createdAt());
    }
}
