package com.tenniswire.discussion_service;

import static org.assertj.core.api.Assertions.assertThat;

import com.tenniswire.discussion_service.repository.UserRestrictionRepository;
import com.tenniswire.discussion_service.service.ReaderErasure;
import com.tenniswire.discussion_service.service.RestrictionService;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class RestrictionHistoryIT {

    @Autowired
    private RestrictionService restrictionService;

    @Autowired
    private UserRestrictionRepository restrictions;

    @Autowired
    private ReaderErasure erasure;

    private final UUID bob = UUID.randomUUID();
    private final UUID moderator = UUID.randomUUID();
    private final UUID anotherModerator = UUID.randomUUID();

    @Test
    void aLiftedBanStaysWithWhoLiftedIt() {
        var ban = restrictionService.restrictCommenting(bob, moderator, null, "flood");

        restrictionService.lift(ban.id(), anotherModerator);

        var row = restrictions.findById(ban.id()).orElseThrow();
        assertThat(row.issuedBy()).isEqualTo(moderator);
        assertThat(row.liftedBy()).isEqualTo(anotherModerator);
        assertThat(row.liftedAt()).isNotNull();
        assertThat(restrictionService.activeFor(bob)).isEmpty();
    }

    @Test
    void anErasedReaderLeavesOnlyTheBanStillRunning() {
        var lifted = restrictionService.restrictCommenting(bob, moderator, null, "first");
        restrictionService.lift(lifted.id(), moderator);
        var running = restrictionService.restrictCommenting(
                bob, moderator, Instant.now().plus(Duration.ofDays(3)), "second");

        erasure.erase(bob);

        assertThat(restrictions.findById(lifted.id())).isEmpty();
        assertThat(restrictions.findById(running.id())).isPresent();
    }
}
