package com.tenniswire.user_service.dto;

import com.tenniswire.user_service.entity.Profile;
import com.tenniswire.user_service.service.AvatarSize;
import com.tenniswire.user_service.service.AvatarUrls;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record AvatarQueueResponse(List<Entry> items) {

    // avatarKey is what the moderator sends back with his decision
    public record Entry(UUID userId, String displayName, String avatarKey, String avatarLargeUrl, Instant updatedAt) {

        public static Entry from(Profile profile, AvatarUrls urls) {
            return new Entry(
                    profile.userId(),
                    profile.displayName(),
                    profile.avatarKey(),
                    urls.of(profile.avatarKey(), AvatarSize.LARGE),
                    profile.avatarUpdatedAt());
        }
    }
}
