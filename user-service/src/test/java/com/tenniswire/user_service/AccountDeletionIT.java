package com.tenniswire.user_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.tenniswire.user_service.client.ErasedReader;
import com.tenniswire.user_service.client.KeycloakAdmin;
import com.tenniswire.user_service.client.ReaderTraceClient;
import com.tenniswire.user_service.entity.PendingIdentityDelete;
import com.tenniswire.user_service.exception.IdentityProviderUnavailableException;
import com.tenniswire.user_service.exception.ResourceNotFoundException;
import com.tenniswire.user_service.repository.PendingIdentityDeleteRepository;
import com.tenniswire.user_service.service.AccountDeletionService;
import com.tenniswire.user_service.service.IdentityService;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class AccountDeletionIT {

    @MockitoBean
    private KeycloakAdmin keycloak;

    @MockitoBean
    private ReaderTraceClient traces;

    @Autowired
    private AccountDeletionService deletions;

    @Autowired
    private IdentityService identities;

    @Autowired
    private PendingIdentityDeleteRepository pending;

    @BeforeEach
    void discussionServiceAnswers() {
        given(traces.erase(any())).willReturn(new ErasedReader(false, null));
    }

    @Test
    void theIdentityIsShutAndHisCommentsGoAtOnce() {
        var subject = UUID.randomUUID().toString();
        var userId = identities.resolve("keycloak", subject);

        deletions.request(userId);

        verify(keycloak).stripAndDisable(subject);
        // the rules promise the comments disappear at once, not when the job gets round to it:
        // started here and not waited on, so it is watched for rather than asserted outright
        verify(traces, timeout(5_000)).erase(userId);
        var record = pending.findById(userId).orElseThrow();
        assertThat(record.subject()).isEqualTo(subject);
        assertThat(record.identityClosedAt()).isNotNull();
        assertThat(record.traceErasedAt()).isNull();
        assertThat(record.addressHeld()).isFalse();
    }

    @Test
    void askingTwiceRecordsOnceAndDoesNotShutWhatIsAlreadyShut() {
        var userId = identities.resolve("keycloak", UUID.randomUUID().toString());

        deletions.request(userId);
        var closedAt = pending.findById(userId).orElseThrow().identityClosedAt();
        deletions.request(userId);

        verify(keycloak, times(1)).stripAndDisable(any());
        // the clock the erase waits on does not restart
        assertThat(pending.findById(userId).orElseThrow().identityClosedAt()).isEqualTo(closedAt);
    }

    @Test
    void keycloakBeingDownStillLeavesTheRequestStanding() {
        var userId = identities.resolve("keycloak", UUID.randomUUID().toString());
        doThrow(new IdentityProviderUnavailableException("down")).when(keycloak).stripAndDisable(any());

        deletions.request(userId);

        // recorded but not closed: the job has both to do, and the reader was not told to try again
        var record = pending.findById(userId).orElseThrow();
        assertThat(record.identityClosedAt()).isNull();
    }

    // A banned reader's profile goes before the account does, and then the record is all that is left
    @Test
    void onBehalfOfSomeoneAlreadyOnTheWayOutTheRecordedAccountIsAskedAbout() {
        var userId = UUID.randomUUID();
        var subject = UUID.randomUUID().toString();
        pending.save(new PendingIdentityDelete(userId, subject));
        given(keycloak.groupsOf(subject)).willReturn(List.of("/readers"));

        deletions.requestOnBehalf(userId);

        verify(keycloak).groupsOf(subject);
        verify(keycloak).stripAndDisable(subject);
    }

    @Test
    void onBehalfOfSomeoneWhoIsNotThereKeycloakIsNotAsked() {
        var missing = UUID.randomUUID();

        assertThatThrownBy(() -> deletions.requestOnBehalf(missing)).isInstanceOf(ResourceNotFoundException.class);

        verify(keycloak, never()).groupsOf(any());
        assertThat(pending.findById(missing)).isEmpty();
    }

    @Test
    void anAccountThatIsNotThereIsNotRecorded() {
        var missing = UUID.randomUUID();

        assertThatThrownBy(() -> deletions.request(missing)).isInstanceOf(ResourceNotFoundException.class);

        assertThat(pending.findById(missing)).isEmpty();
    }
}
