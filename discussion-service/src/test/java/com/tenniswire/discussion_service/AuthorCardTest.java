package com.tenniswire.discussion_service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tenniswire.discussion_service.client.AuthorProfile;
import com.tenniswire.discussion_service.client.AuthorProfileClient;
import com.tenniswire.discussion_service.exception.UserServiceUnavailableException;
import com.tenniswire.discussion_service.security.UserIdResolver;
import com.tenniswire.discussion_service.service.CommentService;
import com.tenniswire.discussion_service.service.RestrictionService;
import java.util.Collection;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

// Anonymous throughout: the card is for a public page, and every answer here also shows the chain
// let an anonymous request through
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class AuthorCardTest {

    private static final String AUTHORS = "/api/discussion/authors/";

    @MockitoBean
    private UserIdResolver resolver;

    @MockitoBean
    private AuthorProfileClient profiles;

    @Autowired
    private CommentService commentService;

    @Autowired
    private RestrictionService restrictionService;

    private final UUID subjectId = UUID.randomUUID();
    private final UUID alice = UUID.randomUUID();

    private MockMvc mvc;

    @BeforeEach
    void bindToChainAndNameAlice(@Autowired WebApplicationContext context) {
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();
        var known = Map.of(alice, "alice");
        when(profiles.profiles(any())).thenAnswer(call -> call.<Collection<UUID>>getArgument(0).stream()
                .filter(known::containsKey)
                .collect(Collectors.toMap(Function.identity(), id -> new AuthorProfile(id, known.get(id), null))));
    }

    @Test
    void aReaderGetsHisNameAndWhatHeWrote() throws Exception {
        commentService.create(alice, "publication", subjectId, "one");
        commentService.create(alice, "publication", subjectId, "two");

        mvc.perform(get(AUTHORS + alice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(alice.toString()))
                .andExpect(jsonPath("$.displayName").value("alice"))
                .andExpect(jsonPath("$.avatarUrl").isEmpty())
                .andExpect(jsonPath("$.commentCount").value(2));
    }

    @Test
    void aRestrictedReaderHasNoPageAndIsNotLookedUp() throws Exception {
        commentService.create(alice, "publication", subjectId, "one");
        restrictionService.restrictCommenting(alice, UUID.randomUUID(), null, "indefinite");

        mvc.perform(get(AUTHORS + alice))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("NOT_FOUND"));
        verifyNoInteractions(profiles);
    }

    @Test
    void anIdNobodyHasIsNotFound() throws Exception {
        mvc.perform(get(AUTHORS + UUID.randomUUID())).andExpect(status().isNotFound());
    }

    // not a 404: the page would claim the reader does not exist
    @Test
    void userServiceDownIsAnOutageRatherThanAbsence() throws Exception {
        doThrow(new UserServiceUnavailableException("down")).when(profiles).profiles(any());

        mvc.perform(get(AUTHORS + alice)).andExpect(status().isServiceUnavailable());
    }
}
