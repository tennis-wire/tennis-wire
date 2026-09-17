package com.tenniswire.discussion_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.tenniswire.discussion_service.client.AuthorProfileClient;
import com.tenniswire.discussion_service.security.UserIdResolver;
import com.tenniswire.discussion_service.service.CommentService;
import com.tenniswire.discussion_service.service.RestrictionService;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

// The reader's own restriction comes with the reads that open a thread, so the page can put the ban
// plate where the form would be before anything is typed
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ViewerRestrictionTest {

    private static final String COMMENTS = "/api/discussion/comments";

    @MockitoBean
    private UserIdResolver resolver;

    @MockitoBean
    private AuthorProfileClient profiles;

    @Autowired
    private CommentService commentService;

    @Autowired
    private RestrictionService restrictionService;

    private final UUID subjectId = UUID.randomUUID();
    private final UUID viewer = UUID.randomUUID();

    private MockMvc mvc;

    @BeforeEach
    void bindToChainAndSignTheViewerIn(@Autowired WebApplicationContext context) {
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();
        when(resolver.resolve(any())).thenReturn(viewer);
        // nobody has a name here, and nothing below needs one
        when(profiles.profiles(any())).thenReturn(Map.of());
    }

    @Test
    void someoneNotSignedInGetsNoViewer() throws Exception {
        mvc.perform(listing())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.viewer").doesNotExist());
    }

    @Test
    void aReaderUnderNoRestrictionIsToldSo() throws Exception {
        mvc.perform(listing().with(reader()))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"viewer\":{\"restriction\":null}}"));
    }

    @Test
    void aTemporaryRestrictionComesWithItsEnd() throws Exception {
        var until = Instant.now().truncatedTo(ChronoUnit.SECONDS).plus(Duration.ofDays(3));
        restrictionService.restrictCommenting(viewer, UUID.randomUUID(), until, "three days");

        var body = mvc.perform(listing().with(reader()))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        assertThat(Instant.parse(JsonPath.<String>read(body, "$.viewer.restriction.until")))
                .isEqualTo(until);
    }

    @Test
    void anIndefiniteRestrictionHasNoEnd() throws Exception {
        restrictionService.restrictCommenting(viewer, UUID.randomUUID(), null, "indefinite");

        mvc.perform(listing().with(reader()))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"viewer\":{\"restriction\":{\"until\":null}}}"));
    }

    // A link opens the thread at the chain, not at the listing; a page of replies opens nothing
    @Test
    void theChainALinkOpensCarriesItAndAPageOfRepliesDoesNot() throws Exception {
        var comment = commentService
                .create(UUID.randomUUID(), "publication", subjectId, "linked")
                .comment();
        restrictionService.restrictCommenting(viewer, UUID.randomUUID(), null, "indefinite");

        mvc.perform(get(COMMENTS + "/" + comment.id() + "/ancestry").with(reader()))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"viewer\":{\"restriction\":{\"until\":null}}}"));
        mvc.perform(get(COMMENTS + "/" + comment.id() + "/replies").with(reader()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.viewer").doesNotExist());
    }

    private MockHttpServletRequestBuilder listing() {
        return get(COMMENTS).param("subjectType", "publication").param("subjectId", subjectId.toString());
    }

    private static RequestPostProcessor reader() {
        return jwt().jwt(j -> j.subject(UUID.randomUUID().toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_user"));
    }
}
