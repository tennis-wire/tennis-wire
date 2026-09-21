package com.tenniswire.user_service.dto;

import com.tenniswire.user_service.entity.Profile;
import com.tenniswire.user_service.service.AvatarSize;
import com.tenniswire.user_service.service.AvatarUrls;
import edu.umd.cs.findbugs.annotations.Nullable;
import java.util.UUID;

// The small size only: this is what goes under every comment
public record PublicProfileResponse(
        UUID id, String displayName, @Nullable String avatarUrl) {

    public static PublicProfileResponse from(Profile profile, AvatarUrls urls) {
        return new PublicProfileResponse(
                profile.userId(), profile.displayName(), urls.of(profile.avatarKey(), AvatarSize.SMALL));
    }
}
