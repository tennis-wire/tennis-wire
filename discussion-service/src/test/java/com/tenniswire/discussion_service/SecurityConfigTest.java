package com.tenniswire.discussion_service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tenniswire.discussion_service.client.AuthorProfile;
import com.tenniswire.discussion_service.client.AuthorProfileClient;
import com.tenniswire.discussion_service.exception.UserServiceUnavailableException;
import com.tenniswire.discussion_service.security.UserIdResolver;
import java.util.Map;
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
    private static final String REPORTS = COMMENTS + "/" + UUID.randomUUID() + "/reports";
    private static final String QUEUE = "/api/discussion/moderation/reports";
    private static final UUID SUBJECT = UUID.randomUUID();

    @MockitoBean
    private UserIdResolver resolver;

    @MockitoBean
    private AuthorProfileClient profiles;

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
    void theAuthorComesFromTheResolverNotFromTheSub() throws Exception {
        var me = UUID.randomUUID();
        when(resolver.resolve(any())).thenReturn(me);
        when(profiles.profiles(any())).thenReturn(Map.of(me, new AuthorProfile(me, "reader-me", null)));

        mvc.perform(post(COMMENTS)
                        .with(tokenWith("ROLE_user"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.comment.author.id").value(me.toString()))
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
    void reportingRejectsAnonymous() throws Exception {
        mvc.perform(post(REPORTS).contentType(MediaType.APPLICATION_JSON).content(reason()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void reportingIsForReadersAndNotForTheBot() throws Exception {
        when(resolver.resolve(any())).thenReturn(UUID.randomUUID());

        mvc.perform(post(REPORTS)
                        .with(tokenWith("ROLE_moderator-bot"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reason()))
                .andExpect(status().isForbidden());

        // 404, not 403: the reader is through the chain and into the handler, where the id is made up.
        mvc.perform(post(REPORTS)
                        .with(tokenWith("ROLE_user"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reason()))
                .andExpect(status().isNotFound());
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
    void theQueueIsForModeratorsAndNotForTheBotThatFillsIt() throws Exception {
        mvc.perform(get(QUEUE).with(tokenWith("ROLE_user"))).andExpect(status().isForbidden());
        mvc.perform(get(QUEUE).with(tokenWith("ROLE_moderator-bot"))).andExpect(status().isForbidden());
        mvc.perform(get(QUEUE).with(tokenWith("ROLE_moderator")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray());

        mvc.perform(patch(QUEUE + "/" + UUID.randomUUID())
                        .with(tokenWith("ROLE_moderator-bot"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"resolution\":\"dismissed\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void aModeratorWithoutTheUserRoleCannotResolveAReport() throws Exception {
        // Same coupling as a restriction: the decision is signed, and the signature is a user_id.
        mvc.perform(patch(QUEUE + "/" + UUID.randomUUID())
                        .with(tokenWith("ROLE_moderator"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"resolution\":\"dismissed\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("FORBIDDEN"));

        verifyNoInteractions(resolver);
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

    private static String reason() {
        return "{\"reason\":\"spam\"}";
    }

    private static String body() {
        return "{\"subjectType\":\"article\",\"subjectId\":\"" + SUBJECT + "\",\"body\":\"hello\"}";
    }
}
