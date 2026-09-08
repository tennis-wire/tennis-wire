package com.tenniswire.discussion_service;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * The authorization rules with a mock JWT, no Keycloak. The real token flow is covered once, in
 * the gateway's Keycloak IT; here the question is only what a token with a given role may reach,
 * plus that author_id really does come from the token.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class SecurityConfigTest {

    private static final String COMMENTS = "/api/discussion/comments";
    private static final UUID SUBJECT = UUID.randomUUID();

    private MockMvc mvc;

    @BeforeEach
    void bindToChain(@Autowired WebApplicationContext context) {
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();
    }

    @Test
    void readingIsAnonymous() throws Exception {
        mvc.perform(get(COMMENTS).param("subjectType", "article").param("subjectId", SUBJECT.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.nextCursor").isEmpty());
    }

    @Test
    void writingRejectsAnonymous() throws Exception {
        mvc.perform(post(COMMENTS).contentType(MediaType.APPLICATION_JSON).content(body()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void writingNeedsTheUserRoleNotJustAToken() throws Exception {
        mvc.perform(post(COMMENTS)
                        .with(asUser(UUID.randomUUID(), "ROLE_author"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body()))
                .andExpect(status().isForbidden());
    }

    @Test
    void authorIdComesFromTheToken() throws Exception {
        var me = UUID.randomUUID();
        mvc.perform(post(COMMENTS)
                        .with(asUser(me, "ROLE_user"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.comment.authorId").value(me.toString()))
                .andExpect(jsonPath("$.comment.visibility").value("visible"))
                .andExpect(jsonPath("$.mutedByRecipient").value(false));
    }

    @Test
    void restrictionsAreModeratorOnlyNotBot() throws Exception {
        var path = "/api/discussion/moderation/restrictions";
        mvc.perform(get(path).param("userId", SUBJECT.toString()).with(asUser(UUID.randomUUID(), "ROLE_user")))
                .andExpect(status().isForbidden());
        mvc.perform(get(path).param("userId", SUBJECT.toString()).with(asUser(UUID.randomUUID(), "ROLE_moderator-bot")))
                .andExpect(status().isForbidden());
        mvc.perform(get(path).param("userId", SUBJECT.toString()).with(asUser(UUID.randomUUID(), "ROLE_moderator")))
                .andExpect(status().isOk());
    }

    @Test
    void theBotMayHideComments() throws Exception {
        mvc.perform(delete("/api/discussion/moderation/comments/" + UUID.randomUUID())
                        .with(asUser(UUID.randomUUID(), "ROLE_moderator-bot")))
                .andExpect(status().isNotFound());
    }

    @Test
    void pathWithoutARuleIsDeniedEvenForAdmin() throws Exception {
        mvc.perform(get("/api/editorial/articles").with(asUser(UUID.randomUUID(), "ROLE_admin")))
                .andExpect(status().isForbidden());
    }

    private static JwtRequestPostProcessor asUser(UUID userId, String role) {
        // sub must be a UUID: that is what ClaimUserIdResolver falls back to
        return jwt().jwt(j -> j.subject(userId.toString())).authorities(new SimpleGrantedAuthority(role));
    }

    private static String body() {
        return "{\"subjectType\":\"article\",\"subjectId\":\"" + SUBJECT + "\",\"body\":\"hello\"}";
    }
}
