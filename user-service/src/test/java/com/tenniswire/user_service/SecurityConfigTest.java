package com.tenniswire.user_service;

import static org.hamcrest.Matchers.startsWith;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class SecurityConfigTest {

    private static final String ME = "/api/users/me";
    private static final String RESOLVE = "/internal/identities/resolve";
    private static final String LOOKUP = "/internal/users";

    // Deleting an account reaches Keycloak, and what is under test here is the chain in front of it
    @MockitoBean
    private com.tenniswire.user_service.client.KeycloakAdmin keycloak;

    private MockMvc mvc;

    @BeforeEach
    void bindToChain(@Autowired WebApplicationContext context) {
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();
    }

    private static JwtRequestPostProcessor tokenWith(String role) {
        return jwt().jwt(builder -> builder.subject(UUID.randomUUID().toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }

    @Test
    void ownProfileNeedsAToken() throws Exception {
        mvc.perform(get(ME)).andExpect(status().isUnauthorized());
    }

    @Test
    void ownProfileNeedsTheUserRole() throws Exception {
        mvc.perform(get(ME).with(tokenWith("service"))).andExpect(status().isForbidden());
    }

    @Test
    void aReaderSeesTheirOwnProfileAndItIsCreatedOnFirstSight() throws Exception {
        mvc.perform(get(ME).with(tokenWith("user")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").isNotEmpty())
                // value(Matcher, Class) and not value(Matcher): with nothing to infer the matcher's type
                // from, javac silently picks the value(Object) overload and compares the matcher
                // itself to the string with equals(). The explicit target type removes the choice.
                .andExpect(jsonPath("$.displayName").value(startsWith("reader-"), String.class))
                .andExpect(jsonPath("$.displayNameChosen").value(false));
    }

    @Test
    void renamingRejectsAShapeTheServiceWouldRefuse() throws Exception {
        mvc.perform(patch(ME)
                        .with(tokenWith("user"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"no spaces allowed\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("BAD_REQUEST"));
    }

    @Test
    void resolveTakesAReaderTokenAndRefusesAServiceOne() throws Exception {
        mvc.perform(post(RESOLVE).with(tokenWith("user")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").isNotEmpty());

        // The second half is the point: a service account must not be able to mint itself a reader
        // profile through the resolve path, whatever the realm decides to put in its token.
        mvc.perform(post(RESOLVE).with(tokenWith("service"))).andExpect(status().isForbidden());
    }

    @Test
    void lookupTakesAServiceTokenAndRefusesAReaderOne() throws Exception {
        var id = UUID.randomUUID().toString();

        mvc.perform(get(LOOKUP).param("ids", id).with(tokenWith("service"))).andExpect(status().isOk());

        mvc.perform(get(LOOKUP).param("ids", id).with(tokenWith("user"))).andExpect(status().isForbidden());
    }

    @Test
    void deletingOwnAccountIsAReadersAlone() throws Exception {
        mvc.perform(delete(ME)).andExpect(status().isUnauthorized());
        mvc.perform(delete(ME).with(tokenWith("service"))).andExpect(status().isForbidden());
        mvc.perform(delete(ME).with(tokenWith("user"))).andExpect(status().isAccepted());
    }

    @Test
    void deletingSomebodyElsesAccountIsSupportsAlone() throws Exception {
        var someone = "/api/users/" + UUID.randomUUID();

        mvc.perform(delete(someone).with(tokenWith("user"))).andExpect(status().isForbidden());
        // an admin gets through the chain; that there is no such account is the service answering
        mvc.perform(delete(someone).with(tokenWith("admin"))).andExpect(status().isNotFound());
    }

    @Test
    void aPathWithNoRuleIsUnreachableWhoeverAsks() throws Exception {
        // anyRequest().denyAll(): adding an endpoint without adding its rule fails closed rather
        // than inheriting somebody else's.
        mvc.perform(get("/api/admin/anything").with(tokenWith("admin"))).andExpect(status().isForbidden());
    }
}
