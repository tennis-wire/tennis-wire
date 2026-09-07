package com.tenniswire.editorial_bff;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * The authorization rules, exercised with a mock JWT so no Keycloak is needed. Nothing here reaches
 * Anthropic or DeepL: an author's request is stopped by the framework (405 for a GET on a POST-only
 * endpoint) after security has already let it through, which is all these tests care about.
 */
@SpringBootTest
class SecurityConfigTest {

    private static final String CHAT = "/api/ai/chat";

    private MockMvc mvc;

    @BeforeEach
    void bindToChain(@Autowired WebApplicationContext context) {
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();
    }

    @Test
    void chatRejectsAnonymous() throws Exception {
        mvc.perform(post(CHAT)).andExpect(status().isUnauthorized());
    }

    @Test
    void chatRejectsNonAuthorRole() throws Exception {
        mvc.perform(post(CHAT).with(jwt().authorities(new SimpleGrantedAuthority("ROLE_user"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void chatLetsAuthorThroughToTheController() throws Exception {
        mvc.perform(get(CHAT).with(jwt().authorities(new SimpleGrantedAuthority("ROLE_author"))))
                .andExpect(status().isMethodNotAllowed());
    }

    @Test
    void translateRejectsAnonymous() throws Exception {
        mvc.perform(post("/api/translate")).andExpect(status().isUnauthorized());
    }

    @Test
    void pathWithoutARuleIsDeniedEvenForAdmin() throws Exception {
        mvc.perform(get("/api/public/articles").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_admin"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void unknownPublicPathIs404NotAnAuthError() throws Exception {
        // Without the ERROR dispatch rule this comes back as 401: the 404 is rendered
        // through /error, which anyRequest().denyAll() would otherwise refuse.
        mvc.perform(get("/api/public/nope")).andExpect(status().isNotFound());
    }
}
