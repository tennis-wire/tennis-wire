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
 * Projection of moderation decisions. Today the only capability is {@code comment}; the
 * column is scoped so that adding another is a value, not a migration.
 */
@Service
@Transactional
public class RestrictionService {

    private final UserRestrictionRepository restrictions;
    private final ReactionService reactions;

    public RestrictionService(UserRestrictionRepository restrictions, ReactionService reactions) {
        this.restrictions = restrictions;
        this.reactions = reactions;
    }

    public UserRestriction restrictCommenting(
            UUID userId, UUID issuedBy, @Nullable Instant expiresAt, @Nullable String reason) {
        return restrictCommenting(userId, issuedBy, expiresAt, reason, false);
    }

    /**
     * clearReactions takes back everything he ever put anywhere. Only with an indefinite ban, and
     * there is no undoing it: the rows are gone, and lifting the ban does not bring them back.
     */
    public UserRestriction restrictCommenting(
            UUID userId, UUID issuedBy, @Nullable Instant expiresAt, @Nullable String reason, boolean clearReactions) {
        if (expiresAt != null && !expiresAt.isAfter(Instant.now())) {
            throw new IllegalArgumentException("expiresAt must be in the future");
        }
        if (clearReactions && expiresAt != null) {
            throw new IllegalArgumentException("clearReactions is only allowed on an indefinite restriction");
        }
        // One ban at a time. A new one replaces what stands, which is how a ban is extended,
        // shortened or made permanent; the one replaced is lifted by whoever issued the new one.
        restrictions.lockReader(userId.hashCode());
        var now = Instant.now();
        for (var standing : restrictions.findActive(userId, UserRestriction.CAPABILITY_COMMENT, now)) {
            standing.liftedAt(now).liftedBy(issuedBy);
        }
        if (clearReactions) {
            reactions.clearAllBy(userId);
        }
        var restriction = new UserRestriction()
                .userId(userId)
                .capability(UserRestriction.CAPABILITY_COMMENT)
                .issuedBy(issuedBy)
                .expiresAt(expiresAt)
                .reason(reason);
        return restrictions.saveAndFlush(restriction);
    }

    // Ends a restriction early. The row stays with who ended it and when. One already lifted or run
    // out is not there to lift.
    public void lift(UUID restrictionId, UUID liftedBy) {
        var now = Instant.now();
        var restriction = restrictions
                .findById(restrictionId)
                .filter(found -> found.isActive(now))
                .orElseThrow(() -> new ResourceNotFoundException("Restriction", restrictionId));
        restriction.liftedAt(now).liftedBy(liftedBy);
    }

    @Transactional(readOnly = true)
    public List<UserRestriction> activeFor(UUID userId) {
        return restrictions.findActive(userId, UserRestriction.CAPABILITY_COMMENT, Instant.now());
    }
}
