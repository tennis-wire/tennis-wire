package com.tenniswire.user_service.service;

// Published inside the transaction that let go of the key; the objects follow once it commits
public record AvatarDiscarded(String avatarKey) {}
