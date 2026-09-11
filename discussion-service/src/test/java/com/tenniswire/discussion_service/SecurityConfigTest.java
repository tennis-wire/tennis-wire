package com.tenniswire.discussion_service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tenniswire.discussion_service.exception.UserServiceUnavailableException;
import com.tenniswire.discussion_service.security.UserIdResolver;
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

    private static final String COMMENTS = "/api/discussion/comments";
    private static final String RESTRICTIONS = "/api/discussion/moderation/restrictions";
    private static final UUID SUBJECT = UUID.randomUUID();

    @MockitoBean
    private UserIdResolver resolver;

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
                        .with(tokenWith("ROLE_author"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body()))
                .andExpect(status().isForbidden());
    }

    @Test
    void authorIdComesFromTheResolverNotFromTheSub() throws Exception {
        var me = UUID.randomUUID();
        when(resolver.resolve(any())).thenReturn(me);

        mvc.perform(post(COMMENTS)
                        .with(tokenWith("ROLE_user"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.comment.authorId").value(me.toString()))
                .andExpect(jsonPath("$.comment.visibility").value("visible"))
                .andExpect(jsonPath("$.mutedByRecipient").value(false));
    }

    @Test
    void aReaderTokenOnAReadIsResolvedSoThatItsBlocksApply() throws Exception {
        when(resolver.resolve(any())).thenReturn(UUID.randomUUID());

        mvc.perform(get(COMMENTS)
                        .param("subjectType", "article")
                        .param("subjectId", SUBJECT.toString())
                        .with(tokenWith("ROLE_user")))
                .andExpect(status().isOk());

        verify(resolver).resolve(any());
    }

    @Test
    void aTokenWithoutTheUserRoleReadsAsAnonymous() throws Exception {
        // A service account has no user_id: user-service would answer 403 and fail the read.
        mvc.perform(get(COMMENTS)
                        .param("subjectType", "article")
                        .param("subjectId", SUBJECT.toString())
                        .with(tokenWith("ROLE_moderator-bot")))
                .andExpect(status().isOk());

        verifyNoInteractions(resolver);
    }

    @Test
    void aModeratorWithoutTheUserRoleCannotIssueARestriction() throws Exception {
        // Only admin is composite with user; a moderator declared in the realm file is not, and
        // issued_by needs a user_id. The JSON error tells this 403 from the chain's empty one.
        mvc.perform(post(RESTRICTIONS)
                        .with(tokenWith("ROLE_moderator"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + UUID.randomUUID() + "\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("FORBIDDEN"));

        verifyNoInteractions(resolver);
    }

    @Test
    void anUnavailableUserServiceIsA503() throws Exception {
        when(resolver.resolve(any())).thenThrow(new UserServiceUnavailableException("down"));

        mvc.perform(post(COMMENTS)
                        .with(tokenWith("ROLE_user"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body()))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("SERVICE_UNAVAILABLE"));
    }

    @Test
    void restrictionsAreModeratorOnlyNotBot() throws Exception {
        mvc.perform(get(RESTRICTIONS).param("userId", SUBJECT.toString()).with(tokenWith("ROLE_user")))
                .andExpect(status().isForbidden());
        mvc.perform(get(RESTRICTIONS).param("userId", SUBJECT.toString()).with(tokenWith("ROLE_moderator-bot")))
                .andExpect(status().isForbidden());
        mvc.perform(get(RESTRICTIONS).param("userId", SUBJECT.toString()).with(tokenWith("ROLE_moderator")))
                .andExpect(status().isOk());
    }

    @Test
    void theBotMayHideComments() throws Exception {
        mvc.perform(delete("/api/discussion/moderation/comments/" + UUID.randomUUID())
                        .with(tokenWith("ROLE_moderator-bot")))
                .andExpect(status().isNotFound());
    }

    @Test
    void pathWithoutARuleIsDeniedEvenForAdmin() throws Exception {
        mvc.perform(get("/api/editorial/articles").with(tokenWith("ROLE_admin")))
                .andExpect(status().isForbidden());
    }

    private static JwtRequestPostProcessor tokenWith(String role) {
        return jwt().jwt(j -> j.subject(UUID.randomUUID().toString())).authorities(new SimpleGrantedAuthority(role));
    }

    private static String body() {
        return "{\"subjectType\":\"article\",\"subjectId\":\"" + SUBJECT + "\",\"body\":\"hello\"}";
    }
}
