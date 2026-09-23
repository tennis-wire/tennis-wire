package com.tenniswire.discussion_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tenniswire.discussion_service.client.AuthorProfile;
import com.tenniswire.discussion_service.client.AuthorProfileClient;
import com.tenniswire.discussion_service.security.UserIdResolver;
import com.tenniswire.discussion_service.service.RestrictionService;
import java.util.Collection;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
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
import org.springframework.test.web.servlet.RequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class RestrictionTargetTest {

    private static final String RESTRICTIONS = "/api/discussion/moderation/restrictions";

    @MockitoBean
    private UserIdResolver resolver;

    @MockitoBean
    private AuthorProfileClient profiles;

    @Autowired
    private RestrictionService restrictionService;

    private final UUID moderator = UUID.randomUUID();
    private final UUID bob = UUID.randomUUID();

    private MockMvc mvc;

    // user-service knows bob and nobody else
    @BeforeEach
    void bindToChainAsTheModerator(@Autowired WebApplicationContext context) {
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();
        when(resolver.resolve(any())).thenReturn(moderator);
        when(profiles.profiles(any())).thenAnswer(call -> call.<Collection<UUID>>getArgument(0).stream()
                .filter(bob::equals)
                .collect(Collectors.toMap(Function.identity(), id -> new AuthorProfile(id, "bob", null))));
    }

    @Test
    void aModeratorCannotRestrictHimself() throws Exception {
        mvc.perform(restrict(moderator)).andExpect(status().isBadRequest());

        assertThat(restrictionService.activeFor(moderator)).isEmpty();
    }

    @Test
    void anIdUserServiceDoesNotKnowIsNobodyToRestrict() throws Exception {
        var nobody = UUID.randomUUID();

        mvc.perform(restrict(nobody))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("USER_NOT_FOUND"));

        assertThat(restrictionService.activeFor(nobody)).isEmpty();
    }

    @Test
    void aKnownReaderIsRestricted() throws Exception {
        mvc.perform(restrict(bob)).andExpect(status().isCreated());

        assertThat(restrictionService.activeFor(bob)).hasSize(1);
    }

    private static RequestBuilder restrict(UUID userId) {
        return post(RESTRICTIONS)
                .with(moderatorToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userId\":\"" + userId + "\"}");
    }

    private static JwtRequestPostProcessor moderatorToken() {
        return jwt().jwt(j -> j.subject(UUID.randomUUID().toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_moderator"), new SimpleGrantedAuthority("ROLE_user"));
    }
}
