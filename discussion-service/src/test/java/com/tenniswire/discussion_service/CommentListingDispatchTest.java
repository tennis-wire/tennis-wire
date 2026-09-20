package com.tenniswire.discussion_service;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tenniswire.discussion_service.client.AuthorProfileClient;
import com.tenniswire.discussion_service.security.UserIdResolver;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

// Two listings answer on /comments and are told apart by their parameters. What is checked here is
// the fork itself: the conditions have to leave no request matching both mappings.
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class CommentListingDispatchTest {

    private static final String COMMENTS = "/api/discussion/comments";

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
    void subjectParametersReachTheSubjectListing() throws Exception {
        mvc.perform(get(COMMENTS)
                        .param("subjectType", "publication")
                        .param("subjectId", UUID.randomUUID().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray());
    }

    @Test
    void anAuthorReachesTheAuthorListing() throws Exception {
        mvc.perform(get(COMMENTS).param("authorId", UUID.randomUUID().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                // nothing is opened here, so the reader's own standing is left out
                .andExpect(jsonPath("$.viewer").doesNotExist());
    }

    // The path matches and no condition does, which Spring answers with 400 rather than 404
    @Test
    void bothAtOnceAreRefused() throws Exception {
        mvc.perform(get(COMMENTS)
                        .param("subjectType", "publication")
                        .param("subjectId", UUID.randomUUID().toString())
                        .param("authorId", UUID.randomUUID().toString()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void neitherOfThemIsRefused() throws Exception {
        mvc.perform(get(COMMENTS)).andExpect(status().isBadRequest());
    }

    @Test
    void theCounterAnswersOnItsOwnPath() throws Exception {
        mvc.perform(get(COMMENTS + "/count").param("authorId", UUID.randomUUID().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(0));
    }
}
