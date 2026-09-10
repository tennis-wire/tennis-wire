package com.tenniswire.user_service.dto;

import com.tenniswire.user_service.entity.Profile;
import edu.umd.cs.findbugs.annotations.Nullable;
import java.util.UUID;

public record PublicProfileResponse(
        UUID id, String displayName, @Nullable String avatarUrl) {

    public static PublicProfileResponse from(Profile profile) {
        return new PublicProfileResponse(profile.userId(), profile.displayName(), null);
    }
}
