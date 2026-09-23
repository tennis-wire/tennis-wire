package com.tenniswire.discussion_service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tenniswire.discussion_service.client.AuthorProfileClient;
import com.tenniswire.discussion_service.security.UserIdResolver;
import com.tenniswire.discussion_service.service.CommentService;
import com.tenniswire.discussion_service.service.RestrictionService;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

// The listing by author is his cabinet for himself and his page for everyone else, and a restricted
// reader has no page
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class RestrictedAuthorListingTest {

    private static final String COMMENTS = "/api/discussion/comments";

    @MockitoBean
    private UserIdResolver resolver;

    @MockitoBean
    private AuthorProfileClient profiles;

    @Autowired
    private CommentService commentService;

    @Autowired
    private RestrictionService restrictionService;

    private final UUID alice = UUID.randomUUID();

    private MockMvc mvc;

    @BeforeEach
    void aliceWroteOnceAndIsBanned(@Autowired WebApplicationContext context) {
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();
        commentService.create(alice, "publication", UUID.randomUUID(), "one");
        restrictionService.restrictCommenting(alice, UUID.randomUUID(), null, "indefinite");
    }

    @Test
    void othersFindNeitherHisCommentsNorTheirNumber() throws Exception {
        mvc.perform(get(COMMENTS).param("authorId", alice.toString()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("NOT_FOUND"));
        mvc.perform(get(COMMENTS + "/count").param("authorId", alice.toString()))
                .andExpect(status().isNotFound());
    }

    @Test
    void heStillSeesHisOwn() throws Exception {
        when(resolver.resolve(any())).thenReturn(alice);
        var asAlice = jwt().jwt(j -> j.subject(UUID.randomUUID().toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_user"));

        mvc.perform(get(COMMENTS).param("authorId", alice.toString()).with(asAlice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1));
        mvc.perform(get(COMMENTS + "/count").param("authorId", alice.toString()).with(asAlice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(1));
    }
}
