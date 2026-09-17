package com.tenniswire.user_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tenniswire.user_service.client.KeycloakAdmin;
import com.tenniswire.user_service.config.DeletionProperties;
import com.tenniswire.user_service.entity.IdentityLink;
import com.tenniswire.user_service.entity.IdentityLinkId;
import com.tenniswire.user_service.repository.IdentityLinkRepository;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class RecentLoginTest {

    private static final String ME = "/api/users/me";

    @MockitoBean
    private KeycloakAdmin keycloak;

    @Autowired
    private IdentityLinkRepository links;

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
    void aLoginJustInsideTheLimitMayDeleteTheAccount() throws Exception {
        var justInside = Instant.now().minus(properties.loginMaxAge()).plusSeconds(30);

        mvc.perform(delete(ME).with(reader(UUID.randomUUID().toString(), justInside)))
                .andExpect(status().isAccepted());
    }

    @Test
    void anOlderLoginIsSentBackToSignInWithNothingWritten() throws Exception {
        var subject = UUID.randomUUID().toString();
        var justOutside = Instant.now().minus(properties.loginMaxAge()).minusSeconds(30);
        var maxAge = "max_age=\"" + properties.loginMaxAge().toSeconds() + "\"";

        mvc.perform(delete(ME).with(reader(subject, justOutside)))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string(
                                HttpHeaders.WWW_AUTHENTICATE,
                                containsString("error=\"insufficient_user_authentication\"")))
                .andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE, containsString(maxAge)))
                .andExpect(jsonPath("$.error").value("REAUTHENTICATION_REQUIRED"));

        // refused before the reader was resolved, so there is not even a profile for him
        assertThat(links.findById(new IdentityLinkId(IdentityLink.KEYCLOAK, subject)))
                .isEmpty();
        verifyNoInteractions(keycloak);
    }

    @Test
    void aTokenThatDoesNotSayWhenTheLoginWasCountsAsAnOldOne() throws Exception {
        mvc.perform(delete(ME).with(reader(UUID.randomUUID().toString(), null)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("REAUTHENTICATION_REQUIRED"));
    }

    private static JwtRequestPostProcessor reader(String subject, Instant signedInAt) {
        return jwt().jwt(builder -> {
                    builder.subject(subject);
                    if (signedInAt != null) {
                        builder.claim("auth_time", signedInAt.getEpochSecond());
                    }
                })
                .authorities(new SimpleGrantedAuthority("ROLE_user"));
    }
}
