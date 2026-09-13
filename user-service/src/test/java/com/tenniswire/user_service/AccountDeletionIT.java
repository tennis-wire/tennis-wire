package com.tenniswire.user_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.tenniswire.user_service.client.KeycloakAdmin;
import com.tenniswire.user_service.exception.IdentityProviderUnavailableException;
import com.tenniswire.user_service.exception.ResourceNotFoundException;
import com.tenniswire.user_service.repository.PendingIdentityDeleteRepository;
import com.tenniswire.user_service.service.AccountDeletionService;
import com.tenniswire.user_service.service.IdentityService;
import java.util.UUID;
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

    @Autowired
    private AccountDeletionService deletions;

    @Autowired
    private IdentityService identities;

    @Autowired
    private PendingIdentityDeleteRepository pending;

    @Test
    void theIdentityIsShutAndWhatIsLeftIsWrittenDown() {
        var subject = UUID.randomUUID().toString();
        var userId = identities.resolve("keycloak", subject);

        deletions.request(userId);

        verify(keycloak).stripAndDisable(subject);
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

    @Test
    void anAccountThatIsNotThereIsNotRecorded() {
        var missing = UUID.randomUUID();

        assertThatThrownBy(() -> deletions.request(missing)).isInstanceOf(ResourceNotFoundException.class);

        assertThat(pending.findById(missing)).isEmpty();
    }
}
