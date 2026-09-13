package com.tenniswire.user_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.tenniswire.user_service.client.ErasedReader;
import com.tenniswire.user_service.client.KeycloakAdmin;
import com.tenniswire.user_service.client.ReaderTraceClient;
import com.tenniswire.user_service.config.ErasureProperties;
import com.tenniswire.user_service.exception.IdentityProviderUnavailableException;
import com.tenniswire.user_service.repository.PendingIdentityDeleteRepository;
import com.tenniswire.user_service.repository.ProfileRepository;
import com.tenniswire.user_service.service.AccountDeletionService;
import com.tenniswire.user_service.service.AccountErasure;
import com.tenniswire.user_service.service.ErasureJob;
import com.tenniswire.user_service.service.IdentityService;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/**
 * The job is driven a pass at a time rather than left to its clock: which pass is being looked at is
 * the whole question here, and a timer running alongside would make the call counts meaningless.
 * The scheduled bean stays off, as it is for every test in this service.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@TestPropertySource(properties = {"user.erasure.grace-margin=2m", "user.erasure.recheck=5m"})
class AccountErasureIT {

    private static final Duration LIFESPAN = Duration.ofMinutes(5);
    private static final Duration LONG_ENOUGH = Duration.ofMinutes(30);

    @MockitoBean
    private KeycloakAdmin keycloak;

    @MockitoBean
    private ReaderTraceClient traces;

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

        // once from the request itself and once from the pass, and not a third time
        verify(traces, times(2)).erase(userId);
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

    private UUID askedToLeave() {
        var userId = identities.resolve("keycloak", UUID.randomUUID().toString());
        deletions.request(userId);
        return userId;
    }

    private void pauseIsOver(UUID userId) {
        var record = pending.findById(userId).orElseThrow();
        pending.saveAndFlush(record.identityClosedAt(Instant.now().minus(LONG_ENOUGH)));
    }

    private void askedLongEnoughAgo(UUID userId) {
        var record = pending.findById(userId).orElseThrow();
        pending.saveAndFlush(record.lastAttemptAt(Instant.now().minus(LONG_ENOUGH)));
    }
}
