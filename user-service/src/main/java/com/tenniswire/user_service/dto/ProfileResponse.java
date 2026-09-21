package com.tenniswire.user_service.dto;

import com.tenniswire.user_service.entity.Profile;
import com.tenniswire.user_service.service.AvatarSize;
import com.tenniswire.user_service.service.AvatarUrls;
import edu.umd.cs.findbugs.annotations.Nullable;
import java.time.Instant;
import java.util.UUID;

public record ProfileResponse(
        UUID userId,
        String displayName,
        boolean displayNameChosen,
        @Nullable String avatarUrl,
        @Nullable String avatarLargeUrl,
        Instant createdAt) {

    public static ProfileResponse from(Profile profile, AvatarUrls urls) {
        return new ProfileResponse(
                profile.userId(),
                profile.displayName(),
                profile.displayNameChosen(),
                urls.of(profile.avatarKey(), AvatarSize.SMALL),
                urls.of(profile.avatarKey(), AvatarSize.LARGE),
                profile.createdAt());
    }
}
