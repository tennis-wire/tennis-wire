package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.entity.UserRestriction;
import com.tenniswire.discussion_service.exception.ResourceNotFoundException;
import com.tenniswire.discussion_service.repository.UserRestrictionRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Projection of moderation decisions (spec §8). Today the only capability is {@code comment}; the
 * column is scoped so that adding another is a value, not a migration.
 */
@Service
@Transactional
public class RestrictionService {

    private final UserRestrictionRepository restrictions;

    public RestrictionService(UserRestrictionRepository restrictions) {
        this.restrictions = restrictions;
    }

    public UserRestriction restrictCommenting(
            UUID userId, UUID issuedBy, @Nullable Instant expiresAt, @Nullable String reason) {
        if (expiresAt != null && !expiresAt.isAfter(Instant.now())) {
            throw new IllegalArgumentException("expiresAt must be in the future");
        }
        var restriction = new UserRestriction()
                .userId(userId)
                .capability(UserRestriction.CAPABILITY_COMMENT)
                .issuedBy(issuedBy)
                .expiresAt(expiresAt)
                .reason(reason);
        return restrictions.saveAndFlush(restriction);
    }

    /** Lifts a restriction early. The row is removed: the audit copy lives in the moderation domain. */
    public void lift(UUID restrictionId) {
        if (!restrictions.existsById(restrictionId)) {
            throw new ResourceNotFoundException("Restriction", restrictionId);
        }
        restrictions.deleteById(restrictionId);
    }

    @Transactional(readOnly = true)
    public List<UserRestriction> activeFor(UUID userId) {
        return restrictions.findActive(userId, UserRestriction.CAPABILITY_COMMENT, Instant.now());
    }
}
