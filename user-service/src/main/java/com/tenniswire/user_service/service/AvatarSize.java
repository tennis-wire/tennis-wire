package com.tenniswire.user_service.service;

public enum AvatarSize {
    // 36 px under a comment, at 2x and a bit
    SMALL(96),
    // the reader's page and the cabinet
    LARGE(288);

    private final int pixels;

    AvatarSize(int pixels) {
        this.pixels = pixels;
    }

    public int pixels() {
        return pixels;
    }

    public String objectKey(String avatarKey) {
        return pixels + "/" + avatarKey;
    }
}
