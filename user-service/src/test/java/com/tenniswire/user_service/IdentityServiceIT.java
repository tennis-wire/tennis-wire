package com.tenniswire.user_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.tenniswire.user_service.exception.DisplayNameTakenException;
import com.tenniswire.user_service.exception.InvalidDisplayNameException;
import com.tenniswire.user_service.repository.ProfileRepository;
import com.tenniswire.user_service.service.IdentityService;
import com.tenniswire.user_service.service.ProfileService;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class IdentityServiceIT {

    private static final String PROVIDER = "keycloak";

    @Autowired
    private IdentityService identities;

    @Autowired
    private ProfileService profileService;

    @Autowired
    private ProfileRepository profiles;

    private static String newSub() {
        return UUID.randomUUID().toString();
    }

    @Test
    void aSubjectResolvesToTheSameUserEveryTime() {
        var sub = newSub();

        var first = identities.resolve(PROVIDER, sub);
        var second = identities.resolve(PROVIDER, sub);

        assertThat(first).isEqualTo(second);
    }

    @Test
    void differentSubjectsAreDifferentPeople() {
        assertThat(identities.resolve(PROVIDER, newSub())).isNotEqualTo(identities.resolve(PROVIDER, newSub()));
    }

    @Test
    void aFirstResolveIssuesAStubName() {
        var profile = profileService.byId(identities.resolve(PROVIDER, newSub()));

        assertThat(profile.displayName()).matches("reader-[0-9a-f]{8}");
        assertThat(profile.displayNameChosen()).isFalse();
    }

    /**
     * The whole reason the writer throws on zero rows. Eight threads race on one subject: they must
     * agree on a user, and exactly one profile may exist afterwards. A rollback that did not happen
     * shows up here as a count of two or more — profiles nothing points at.
     */
    @Test
    void concurrentFirstResolvesAgreeAndLeaveNoOrphans() throws Exception {
        var sub = newSub();
        var threads = 8;
        var before = profiles.count();
        var start = new CountDownLatch(1);

        try (var pool = Executors.newFixedThreadPool(threads)) {
            var futures = IntStream.range(0, threads)
                    .mapToObj(i -> pool.submit(() -> {
                        start.await();
                        return identities.resolve(PROVIDER, sub);
                    }))
                    .toList();

            start.countDown();

            var resolved = new HashSet<UUID>();
            for (var future : futures) {
                resolved.add(future.get());
            }

            assertThat(resolved).hasSize(1);
            assertThat(profiles.count()).isEqualTo(before + 1);
        }
    }

    @Test
    void renamingRecordsThatTheNameWasChosen() {
        var userId = identities.resolve(PROVIDER, newSub());
        var name = "andrei_" + UUID.randomUUID().toString().substring(0, 8);

        var renamed = profileService.rename(userId, name);

        assertThat(renamed.displayName()).isEqualTo(name);
        assertThat(renamed.displayNameChosen()).isTrue();
    }

    @Test
    void aTakenNameIsRejectedRegardlessOfCase() {
        var name = "Taken_" + UUID.randomUUID().toString().substring(0, 8);
        profileService.rename(identities.resolve(PROVIDER, newSub()), name);

        var other = identities.resolve(PROVIDER, newSub());

        assertThatThrownBy(() -> profileService.rename(other, name.toUpperCase()))
                .isInstanceOf(DisplayNameTakenException.class);
    }

    @Test
    void namesOutsideTheAllowedShapeAreRejected() {
        var userId = identities.resolve(PROVIDER, newSub());

        assertThat(List.of("ab", "a".repeat(25), "has spaces", "emoji-\uD83C\uDFBE", ""))
                .allSatisfy(bad -> assertThatThrownBy(() -> profileService.rename(userId, bad))
                        .isInstanceOf(InvalidDisplayNameException.class));
    }

    @Test
    void lookupReturnsOnlyWhatWasAskedFor() {
        var known = identities.resolve(PROVIDER, newSub());
        identities.resolve(PROVIDER, newSub());

        var found = profileService.lookup(List.of(known, UUID.randomUUID()));

        assertThat(found).singleElement().satisfies(p -> assertThat(p.userId()).isEqualTo(known));
    }

    @Test
    void lookupRefusesMoreIdsThanItAdvertises() {
        var tooMany = IntStream.range(0, ProfileService.MAX_LOOKUP_IDS + 1)
                .mapToObj(i -> UUID.randomUUID())
                .toList();

        assertThatThrownBy(() -> profileService.lookup(tooMany)).isInstanceOf(IllegalArgumentException.class);
    }
}
