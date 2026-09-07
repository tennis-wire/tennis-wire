package com.tenniswire.content_service;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * The authorization rules, exercised with a mock JWT so no Keycloak is needed. The real token flow
 * is covered once, in the gateway's Keycloak IT; here the question is only what a token with a given
 * role may reach.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class SecurityConfigTest {

    private static final String EDITORIAL = "/api/editorial/articles";

    private MockMvc mvc;

    @BeforeEach
    void bindToChain(@Autowired WebApplicationContext context) {
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();
    }

    @Test
    void editorialRejectsAnonymous() throws Exception {
        mvc.perform(get(EDITORIAL)).andExpect(status().isUnauthorized());
    }

    @Test
    void editorialRejectsNonAuthorRole() throws Exception {
        mvc.perform(get(EDITORIAL).with(jwt().authorities(new SimpleGrantedAuthority("ROLE_user"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void editorialAcceptsAuthorRole() throws Exception {
        mvc.perform(get(EDITORIAL).with(jwt().authorities(new SimpleGrantedAuthority("ROLE_author"))))
                .andExpect(status().isOk());
    }

    @Test
    void adminInheritsNothingHere_roleIsCheckedLiterally() throws Exception {
        // Composite roles are flattened by Keycloak into the token; a bare ROLE_admin
        // without ROLE_author is not an author. Documents the contract, not a wish.
        mvc.perform(get(EDITORIAL).with(jwt().authorities(new SimpleGrantedAuthority("ROLE_admin"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void publicIsAnonymous() throws Exception {
        mvc.perform(get("/api/public/articles")).andExpect(status().isOk());
    }

    @Test
    void pathWithoutARuleIsDeniedEvenForAdmin() throws Exception {
        mvc.perform(get("/api/comments/1").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_admin"))))
                .andExpect(status().isForbidden());
    }
}
