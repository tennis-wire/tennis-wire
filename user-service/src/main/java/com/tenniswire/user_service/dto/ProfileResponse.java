package com.tenniswire.user_service.dto;

import com.tenniswire.user_service.entity.Profile;
import java.time.Instant;
import java.util.UUID;

public record ProfileResponse(UUID userId, String displayName, boolean displayNameChosen, Instant createdAt) {

    public static ProfileResponse from(Profile profile) {
        return new ProfileResponse(
                profile.userId(), profile.displayName(), profile.displayNameChosen(), profile.createdAt());
    }
}
