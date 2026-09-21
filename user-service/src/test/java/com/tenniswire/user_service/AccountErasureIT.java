package com.tenniswire.user_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;

import com.tenniswire.user_service.client.AvatarStorage;
import com.tenniswire.user_service.client.ErasedReader;
import com.tenniswire.user_service.client.KeycloakAdmin;
import com.tenniswire.user_service.client.ReaderTraceClient;
import com.tenniswire.user_service.config.ErasureProperties;
import com.tenniswire.user_service.exception.DisplayNameTakenException;
import com.tenniswire.user_service.exception.IdentityProviderUnavailableException;
import com.tenniswire.user_service.repository.DisplayNameReservationRepository;
import com.tenniswire.user_service.repository.PendingIdentityDeleteRepository;
import com.tenniswire.user_service.repository.ProfileRepository;
import com.tenniswire.user_service.service.AccountDeletionService;
import com.tenniswire.user_service.service.AccountErasure;
import com.tenniswire.user_service.service.ErasureJob;
import com.tenniswire.user_service.service.IdentityService;
import com.tenniswire.user_service.service.ProfileService;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The job is driven a pass at a time rather than left to its clock: which pass is being looked at is
 * the whole question here, and a timer running alongside would make the call counts meaningless.
 * The scheduled bean stays off, as it is for every test in this service.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@TestPropertySource(
        properties = {
            "user.erasure.grace-margin=2m",
            "user.erasure.recheck=5m",
            "user.erasure.retry-backoff=1m",
            "user.erasure.retry-cap=1h"
        })
class AccountErasureIT {

    private static final Duration LIFESPAN = Duration.ofMinutes(5);
    private static final Duration LONG_ENOUGH = Duration.ofMinutes(30);

    @MockitoBean
    private KeycloakAdmin keycloak;

    @MockitoBean
    private ReaderTraceClient traces;

    @MockitoBean
    private AvatarStorage storage;

    @Autowired
    private TransactionTemplate transactions;

    @Autowired
    private AccountErasure erasure;

    @Autowired
    private ErasureProperties properties;

    @Autowired
    private AccountDeletionService deletions;

    @Autowired
    private IdentityService identities;

    @Autowired
    private PendingIdentityDeleteRepository pending;

    @Autowired
    private ProfileRepository profiles;

    @Autowired
    private ProfileService profileService;

    @Autowired
    private DisplayNameReservationRepository names;

    private ErasureJob job;

    @BeforeEach
    void aFreshPassThatKeycloakAnswers() {
        // Built here rather than injected. The bean is switched off under test, and a new one each
        // time means each test decides for itself what the realm says - a shared one would answer
        // out of a cache filled by whichever test ran first.
        job = new ErasureJob(erasure, keycloak, properties);
        given(keycloak.accessTokenLifespan()).willReturn(LIFESPAN);
        given(traces.erase(any())).willReturn(new ErasedReader(false, null));
    }

    @Test
    void anIdentityLeftOpenIsClosedFirstAndNothingElseHappensThatPass() {
        doThrow(new IdentityProviderUnavailableException("down")).when(keycloak).stripAndDisable(any());
        var userId = askedToLeave();
        assertThat(pending.findById(userId).orElseThrow().identityClosedAt()).isNull();
        reset(keycloak);
        given(keycloak.accessTokenLifespan()).willReturn(LIFESPAN);

        job.pass();

        verify(keycloak).stripAndDisable(any());
        assertThat(pending.findById(userId).orElseThrow().identityClosedAt()).isNotNull();
        // the wait starts here, so the profile is still standing
        assertThat(profiles.findById(userId)).isPresent();
    }

    @Test
    void nothingIsTakenAwayWhileATokenOfHisCouldStillBeGood() {
        var userId = askedToLeave();

        job.pass();

        assertThat(profiles.findById(userId)).isPresent();
        verify(keycloak, never()).delete(any());
    }

    @Test
    void onceThePauseIsOverTheProfileAndTheAccountBothGo() {
        var userId = askedToLeave();
        var subject = pending.findById(userId).orElseThrow().subject();
        pauseIsOver(userId);

        job.pass();

        assertThat(profiles.findById(userId)).isEmpty();
        verify(keycloak).delete(subject);
        assertThat(pending.findById(userId)).isEmpty();
    }

    @Test
    void theAvatarLeavesTheBucketOnlyWithTheProfile() {
        var userId = askedToLeave();
        var avatarKey = userId + "/00112233445566778899aabbccddeeff.jpg";
        transactions.executeWithoutResult(status -> profiles.setAvatar(userId, avatarKey));

        job.pass();
        verify(storage, never()).delete(any());

        pauseIsOver(userId);
        job.pass();

        assertThat(profiles.findById(userId)).isEmpty();
        verify(storage).delete("96/" + avatarKey);
        verify(storage).delete("288/" + avatarKey);
    }

    @Test
    void aReaderStillServingABanLosesEverythingButKeepsHisAddress() {
        given(traces.erase(any()))
                .willReturn(new ErasedReader(true, Instant.now().plus(Duration.ofDays(3))));
        var userId = askedToLeave();
        pauseIsOver(userId);

        job.pass();

        assertThat(profiles.findById(userId)).isEmpty();
        // the account stays, disabled, so the address cannot be taken again before the ban is over
        verify(keycloak, never()).delete(any());
        var record = pending.findById(userId).orElseThrow();
        assertThat(record.addressHeld()).isTrue();
        assertThat(record.addressHeldUntil()).isNotNull();
    }

    @Test
    void whetherTheBanStillHoldsIsAskedAgainRatherThanRemembered() {
        given(traces.erase(any())).willReturn(new ErasedReader(true, null));
        var userId = askedToLeave();
        pauseIsOver(userId);
        job.pass();
        assertThat(pending.findById(userId)).isPresent();

        // lifted in the meantime, which nothing here would ever be told about
        given(traces.erase(any())).willReturn(new ErasedReader(false, null));
        askedLongEnoughAgo(userId);
        job.pass();

        assertThat(pending.findById(userId)).isEmpty();
        verify(keycloak).delete(any());
    }

    @Test
    void anAddressAlreadyHeldIsNotAskedAboutEveryMinute() {
        given(traces.erase(any())).willReturn(new ErasedReader(true, null));
        var userId = askedToLeave();
        pauseIsOver(userId);

        job.pass();
        job.pass();

        // once when he asked to leave and once on the pass, and not a third time
        verify(traces, timeout(5_000).times(2)).erase(userId);
    }

    @Test
    void aPassIsSkippedWhenTheRealmWillNotSayHowLongTokensLast() {
        var userId = askedToLeave();
        pauseIsOver(userId);
        given(keycloak.accessTokenLifespan()).willThrow(new IdentityProviderUnavailableException("down"));

        job.pass();

        // nothing is taken away on a guess
        assertThat(profiles.findById(userId)).isPresent();
        assertThat(pending.findById(userId)).isPresent();
    }

    @Test
    void anAccountThatCannotBeFinishedIsRecordedAndLeftForNextTime() {
        var userId = askedToLeave();
        pauseIsOver(userId);
        doThrow(new IdentityProviderUnavailableException("down")).when(keycloak).delete(any());

        job.pass();

        var record = pending.findById(userId).orElseThrow();
        assertThat(record.attempts()).isEqualTo(1);
        assertThat(record.lastError()).contains("IdentityProviderUnavailableException");
        // what did work is kept: the trace is gone and so is the profile
        assertThat(record.traceErasedAt()).isNotNull();
        assertThat(profiles.findById(userId)).isEmpty();
    }

    @Test
    void theNameHeGaveUpDoesNotGoStraightBackIntoCirculation() {
        var userId = askedToLeave();
        var name = profiles.findById(userId).orElseThrow().displayName();
        pauseIsOver(userId);

        job.pass();

        // his profile is gone, so nothing but the reservation is standing in the way
        assertThat(profiles.findById(userId)).isEmpty();
        var someoneElse = identities.resolve("keycloak", UUID.randomUUID().toString());
        assertThatThrownBy(() -> profileService.rename(someoneElse, name))
                .isInstanceOf(DisplayNameTakenException.class);
    }

    @Test
    void aNameHeldLongEnoughComesBack() {
        var userId = askedToLeave();
        var name = profiles.findById(userId).orElseThrow().displayName();
        pauseIsOver(userId);
        job.pass();
        heldLongEnoughAgo(name);

        job.pass();

        var someoneElse = identities.resolve("keycloak", UUID.randomUUID().toString());
        assertThat(profileService.rename(someoneElse, name).displayName()).isEqualTo(name);
    }

    @Test
    void anAccountThatKeepsFailingIsLookedAtLessAndLessOften() {
        var userId = askedToLeave();
        pauseIsOver(userId);
        doThrow(new IdentityProviderUnavailableException("down")).when(keycloak).delete(any());

        job.pass();
        job.pass();

        // the second pass left it alone: one failure already buys a minute
        assertThat(pending.findById(userId).orElseThrow().attempts()).isEqualTo(1);
    }

    @Test
    void oneAccountThatCannotBeAdvancedDoesNotTakeTheRestOfThePassWithIt() {
        var doomed = askedToLeave();
        var other = askedToLeave();
        pauseIsOver(doomed);
        pauseIsOver(other);
        doThrow(new IllegalStateException("something nobody expected"))
                .when(traces)
                .erase(doomed);

        job.pass();

        assertThat(pending.findById(doomed)).isPresent();
        assertThat(pending.findById(other)).isEmpty();
    }

    @Test
    void accountsThatAreNeverFinishedDoNotFillThePage() {
        // A ban with no end holds its address for good, so these rows never go. One more than a
        // page of them, all of them older than the account that comes next.
        for (var i = 0; i <= 50; i++) {
            heldForGood();
        }
        var freshOne = askedToLeave();
        pauseIsOver(freshOne);

        job.pass();

        assertThat(pending.findById(freshOne)).isEmpty();
    }

    private UUID askedToLeave() {
        var userId = identities.resolve("keycloak", UUID.randomUUID().toString());
        deletions.request(userId);
        return userId;
    }

    // An account parked for good, in the state one actually lives in: its trace erased, its address
    // held, and a date on it for when the ban is worth asking about again
    private void heldForGood() {
        var userId = askedToLeave();
        var record = pending.findById(userId).orElseThrow();
        pending.saveAndFlush(record.identityClosedAt(Instant.now().minus(LONG_ENOUGH))
                .traceErasedAt(Instant.now().minus(LONG_ENOUGH))
                .addressHeld(true)
                .lastAttemptAt(Instant.now())
                .retryAfter(Instant.now().plus(Duration.ofMinutes(5))));
    }

    private void pauseIsOver(UUID userId) {
        var record = pending.findById(userId).orElseThrow();
        pending.saveAndFlush(
                record.identityClosedAt(Instant.now().minus(LONG_ENOUGH)).retryAfter(null));
    }

    private void heldLongEnoughAgo(String name) {
        var reservation = names.findById(name.toLowerCase(Locale.ROOT)).orElseThrow();
        names.saveAndFlush(reservation.reservedUntil(Instant.now().minus(LONG_ENOUGH)));
    }

    private void askedLongEnoughAgo(UUID userId) {
        var record = pending.findById(userId).orElseThrow();
        pending.saveAndFlush(record.lastAttemptAt(Instant.now().minus(LONG_ENOUGH))
                .retryAfter(Instant.now().minus(LONG_ENOUGH)));
    }
}
