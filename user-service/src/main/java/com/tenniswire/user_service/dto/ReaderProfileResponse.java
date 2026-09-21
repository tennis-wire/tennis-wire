package com.tenniswire.user_service.dto;

import com.tenniswire.user_service.entity.Profile;
import com.tenniswire.user_service.service.AvatarSize;
import com.tenniswire.user_service.service.AvatarUrls;
import edu.umd.cs.findbugs.annotations.Nullable;
import java.time.Instant;
import java.util.UUID;

public record ReaderProfileResponse(
        UUID id,
        String displayName,
        @Nullable String avatarUrl,
        @Nullable String avatarLargeUrl,
        Instant createdAt) {

    public static ReaderProfileResponse from(Profile profile, AvatarUrls urls) {
        return new ReaderProfileResponse(
                profile.userId(),
                profile.displayName(),
                urls.of(profile.avatarKey(), AvatarSize.SMALL),
                urls.of(profile.avatarKey(), AvatarSize.LARGE),
                profile.createdAt());
    }
}
