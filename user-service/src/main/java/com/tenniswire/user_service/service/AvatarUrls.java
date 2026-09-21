package com.tenniswire.user_service.service;

import com.tenniswire.user_service.config.MediaProperties;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

@Component
public class AvatarUrls {

    private final String base;

    public AvatarUrls(MediaProperties properties) {
        var configured = properties.publicBaseUrl();
        this.base = configured.endsWith("/") ? configured.substring(0, configured.length() - 1) : configured;
    }

    public @Nullable String of(@Nullable String avatarKey, AvatarSize size) {
        return avatarKey == null ? null : base + "/" + size.objectKey(avatarKey);
    }
}
