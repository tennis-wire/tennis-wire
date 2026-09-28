package com.tenniswire.user_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tenniswire.user_service.client.KeycloakAdmin;
import com.tenniswire.user_service.config.DeletionProperties;
import com.tenniswire.user_service.entity.IdentityLink;
import com.tenniswire.user_service.entity.IdentityLinkId;
import com.tenniswire.user_service.exception.IdentityProviderUnavailableException;
import com.tenniswire.user_service.repository.IdentityLinkRepository;
import com.tenniswire.user_service.repository.PendingIdentityDeleteRepository;
import com.tenniswire.user_service.service.IdentityService;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

// A staff account is only ever disabled: its sub owns articles and signs revisions (staff.md §6)
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class StaffAccountDeletionTest {

    private static final String ME = "/api/users/me";
    private static final Object NO_CLAIM = new Object();

    @MockitoBean
    private KeycloakAdmin keycloak;

    @Autowired
    private IdentityService identities;

    @Autowired
    private IdentityLinkRepository links;

    @Autowired
    private PendingIdentityDeleteRepository pending;

    @Autowired
    private DeletionProperties properties;

    private MockMvc mvc;

    @BeforeEach
    void bindToChain(@Autowired WebApplicationContext context) {
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();
    }

    @Test
    void staffAreRefusedBeforeBeingSentBackToSignIn() throws Exception {
        var subject = UUID.randomUUID().toString();

        // an old login: were the order the other way round, this would be a 401 and a loop
        // through the login page ending in the same refusal
        mvc.perform(delete(ME).with(caller(subject, "user", oldLogin(), List.of("/staff/authors"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("STAFF_ACCOUNT"));

        assertNothingWrittenFor(subject);
    }

    // editorial-ui and dev-cli have no groups mapper, and Keycloak leaves the claim out for an
    // account in no group at all: nothing here says this is a reader
    @Test
    void aTokenWithoutGroupsIsRefusedAsStaffWould() throws Exception {
        var subject = UUID.randomUUID().toString();

        mvc.perform(delete(ME).with(caller(subject, "user", Instant.now(), NO_CLAIM)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("STAFF_ACCOUNT"));

        assertNothingWrittenFor(subject);
    }

    @Test
    void aGroupsClaimOfTheWrongShapeIsNotReadIntoEither() throws Exception {
        var subject = UUID.randomUUID().toString();

        mvc.perform(delete(ME).with(caller(subject, "user", Instant.now(), "/readers")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("STAFF_ACCOUNT"));

        assertNothingWrittenFor(subject);
    }

    @Test
    void readersMayLeave() throws Exception {
        mvc.perform(delete(ME).with(caller(UUID.randomUUID().toString(), "user", Instant.now(), List.of("/readers"))))
                .andExpect(status().isAccepted());
        mvc.perform(delete(ME).with(caller(UUID.randomUUID().toString(), "user", Instant.now(), List.of())))
                .andExpect(status().isAccepted());
        mvc.perform(delete(ME).with(caller(UUID.randomUUID().toString(), "user", Instant.now(), List.of("/staffers"))))
                .andExpect(status().isAccepted());
    }

    @Test
    void anAdminWithAnOldLoginIsSentBackToSignIn() throws Exception {
        var userId = identities.resolve(IdentityLink.KEYCLOAK, UUID.randomUUID().toString());

        mvc.perform(delete("/api/users/" + userId).with(admin(oldLogin())))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("REAUTHENTICATION_REQUIRED"));

        verifyNoInteractions(keycloak);
        assertThat(pending.findById(userId)).isEmpty();
    }

    @Test
    void anAdminCannotDeleteAStaffAccount() throws Exception {
        var subject = UUID.randomUUID().toString();
        var userId = identities.resolve(IdentityLink.KEYCLOAK, subject);
        given(keycloak.groupsOf(subject)).willReturn(List.of("/staff/moderators"));

        mvc.perform(delete("/api/users/" + userId).with(admin(Instant.now())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("STAFF_ACCOUNT"));

        verify(keycloak, never()).stripAndDisable(any());
        assertThat(pending.findById(userId)).isEmpty();
    }

    // Fail closed: the question is whether this is a reader, and no answer is not a yes
    @Test
    void keycloakNotAnsweringStopsTheDeletionWithNothingWritten() throws Exception {
        var subject = UUID.randomUUID().toString();
        var userId = identities.resolve(IdentityLink.KEYCLOAK, subject);
        given(keycloak.groupsOf(subject)).willThrow(new IdentityProviderUnavailableException("down"));

        mvc.perform(delete("/api/users/" + userId).with(admin(Instant.now())))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("SERVICE_UNAVAILABLE"));

        verify(keycloak, never()).stripAndDisable(any());
        assertThat(pending.findById(userId)).isEmpty();
    }

    @Test
    void anAdminDeletesAReader() throws Exception {
        var subject = UUID.randomUUID().toString();
        var userId = identities.resolve(IdentityLink.KEYCLOAK, subject);
        given(keycloak.groupsOf(subject)).willReturn(List.of("/readers"));

        mvc.perform(delete("/api/users/" + userId).with(admin(Instant.now()))).andExpect(status().isAccepted());

        verify(keycloak).stripAndDisable(subject);
        assertThat(pending.findById(userId)).isPresent();
    }

    @Test
    void anAccountThatIsNotThereIsNotAskedAbout() throws Exception {
        mvc.perform(delete("/api/users/" + UUID.randomUUID()).with(admin(Instant.now())))
                .andExpect(status().isNotFound());

        verifyNoInteractions(keycloak);
    }

    private void assertNothingWrittenFor(String subject) {
        // refused before the caller was resolved, so there is not even a profile
        assertThat(links.findById(new IdentityLinkId(IdentityLink.KEYCLOAK, subject)))
                .isEmpty();
        verifyNoInteractions(keycloak);
    }

    private Instant oldLogin() {
        return Instant.now().minus(properties.loginMaxAge()).minusSeconds(30);
    }

    private static JwtRequestPostProcessor admin(Instant signedInAt) {
        return caller(UUID.randomUUID().toString(), "admin", signedInAt, NO_CLAIM);
    }

    private static JwtRequestPostProcessor caller(String subject, String role, Instant signedInAt, Object groups) {
        return jwt().jwt(builder -> {
                    builder.subject(subject).claim("auth_time", signedInAt.getEpochSecond());
                    if (groups != NO_CLAIM) {
                        builder.claim("groups", groups);
                    }
                })
                .authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }
}
