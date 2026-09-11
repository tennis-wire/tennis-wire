package com.tenniswire.discussion_service;

import static org.assertj.core.api.Assertions.assertThat;

import com.tenniswire.discussion_service.entity.UserRestriction;
import com.tenniswire.discussion_service.repository.UserRestrictionRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class UserRestrictionRepositoryIT {

    @Autowired
    private UserRestrictionRepository restrictions;

    @Test
    void findsOnlyActiveCommentRestrictionsAmongTheUsersAsked() {
        var indefinite = restricted(null, UserRestriction.CAPABILITY_COMMENT);
        var untilLater = restricted(Instant.now().plus(Duration.ofHours(1)), UserRestriction.CAPABILITY_COMMENT);
        var expired = restricted(Instant.now().minus(Duration.ofMinutes(1)), UserRestriction.CAPABILITY_COMMENT);
        var otherCapability = restricted(null, "react");
        var notAsked = restricted(null, UserRestriction.CAPABILITY_COMMENT);
        var free = UUID.randomUUID();

        var found = restrictions.findRestrictedAmong(
                List.of(indefinite, untilLater, expired, otherCapability, free),
                UserRestriction.CAPABILITY_COMMENT,
                Instant.now());

        assertThat(found).containsExactlyInAnyOrder(indefinite, untilLater).doesNotContain(notAsked);
    }

    private UUID restricted(@Nullable Instant expiresAt, String capability) {
        var userId = UUID.randomUUID();
        restrictions.saveAndFlush(restriction(userId, expiresAt, capability));
        return userId;
    }

    // Built directly rather than through RestrictionService, which refuses an expiry in the past.
    private static UserRestriction restriction(UUID userId, @Nullable Instant expiresAt, String capability) {
        return new UserRestriction()
                .userId(userId)
                .capability(capability)
                .issuedBy(UUID.randomUUID())
                .expiresAt(expiresAt);
    }
}
