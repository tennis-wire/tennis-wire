package com.tenniswire.discussion_service.dto.moderation;

import com.tenniswire.discussion_service.entity.UserRestriction;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record RestrictionResponse(
        UUID id, UUID userId, String capability, Instant expiresAt, UUID issuedBy, String reason, Instant createdAt) {

    public static RestrictionResponse from(UserRestriction r) {
        return new RestrictionResponse(
                r.id(), r.userId(), r.capability(), r.expiresAt(), r.issuedBy(), r.reason(), r.createdAt());
    }

    public static List<RestrictionResponse> from(List<UserRestriction> restrictions) {
        return restrictions.stream().map(RestrictionResponse::from).toList();
    }
}
