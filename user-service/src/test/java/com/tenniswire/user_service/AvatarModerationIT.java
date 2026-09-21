package com.tenniswire.user_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tenniswire.user_service.client.AvatarStorage;
import com.tenniswire.user_service.repository.ProfileRepository;
import com.tenniswire.user_service.service.IdentityService;
import java.util.HexFormat;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class AvatarModerationIT {

    private static final String QUEUE = "/api/users/moderation/avatars";
    private static final String ENTRY = "$.items[?(@.userId == '%s')]";

    @MockitoBean
    private AvatarStorage storage;

    @Autowired
    private IdentityService identities;

    @Autowired
    private ProfileRepository profiles;

    @Autowired
    private TransactionTemplate transactions;

    private MockMvc mvc;
    private UUID userId;
    private String first;

    @BeforeEach
    void aReaderWithAnAvatar(@Autowired WebApplicationContext context) {
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();
        userId = identities.resolve("keycloak", UUID.randomUUID().toString());
        first = upload();
    }

    @Test
    void aNewAvatarWaitsForReview() throws Exception {
        mvc.perform(get(QUEUE).param("size", "200").with(tokenWith("moderator")))
                .andExpect(status().isOk())
                .andExpect(jsonPath(ENTRY + ".avatarKey", userId).value(first))
                .andExpect(
                        jsonPath(ENTRY + ".avatarLargeUrl", userId).value("http://localhost:9000/avatars/288/" + first))
                .andExpect(jsonPath(ENTRY + ".updatedAt", userId).isNotEmpty());
    }

    @Test
    void okTakesItOutOfTheQueue() throws Exception {
        review(first).andExpect(status().isNoContent());

        mvc.perform(get(QUEUE).param("size", "200").with(tokenWith("moderator")))
                .andExpect(jsonPath(ENTRY, userId).isEmpty());
    }

    @Test
    void anAvatarChangedAfterOkComesBack() throws Exception {
        review(first).andExpect(status().isNoContent());

        var second = upload();

        mvc.perform(get(QUEUE).param("size", "200").with(tokenWith("moderator")))
                .andExpect(jsonPath(ENTRY + ".avatarKey", userId).value(second));
    }

    @Test
    void okForAnAvatarSinceReplacedPassesNothing() throws Exception {
        var second = upload();

        review(first)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("AVATAR_CHANGED"));

        mvc.perform(get(QUEUE).param("size", "200").with(tokenWith("moderator")))
                .andExpect(jsonPath(ENTRY + ".avatarKey", userId).value(second));
    }

    @Test
    void takingDownEmptiesTheProfileAndTheBucket() throws Exception {
        mvc.perform(delete("/api/users/" + userId + "/avatar")
                        .param("avatarKey", first)
                        .with(tokenWith("moderator")))
                .andExpect(status().isNoContent());

        assertThat(profiles.findById(userId).orElseThrow().avatarKey()).isNull();
        verify(storage).delete("96/" + first);
        verify(storage).delete("288/" + first);
    }

    @Test
    void takingDownSomethingNewerIsRefused() throws Exception {
        var second = upload();

        mvc.perform(delete("/api/users/" + userId + "/avatar")
                        .param("avatarKey", first)
                        .with(tokenWith("moderator")))
                .andExpect(status().isConflict());

        assertThat(profiles.findById(userId).orElseThrow().avatarKey()).isEqualTo(second);
        verify(storage, never()).delete(any());
    }

    @Test
    void takingDownWhatIsAlreadyGoneIsFine() throws Exception {
        transactions.executeWithoutResult(status -> profiles.setAvatar(userId, null));

        mvc.perform(delete("/api/users/" + userId + "/avatar")
                        .param("avatarKey", first)
                        .with(tokenWith("moderator")))
                .andExpect(status().isNoContent());
    }

    @Test
    void okForSomeoneNobodyHasIsNotFound() throws Exception {
        mvc.perform(put("/api/users/" + UUID.randomUUID() + "/avatar/review")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"avatarKey\":\"" + first + "\"}")
                        .with(tokenWith("moderator")))
                .andExpect(status().isNotFound());
    }

    @Test
    void theQueueAndBothDecisionsAreAModeratorsAlone() throws Exception {
        mvc.perform(get(QUEUE).with(tokenWith("user"))).andExpect(status().isForbidden());
        mvc.perform(delete("/api/users/" + userId + "/avatar").with(tokenWith("user")))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/users/" + userId + "/avatar/review")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"avatarKey\":\"" + first + "\"}")
                        .with(tokenWith("user")))
                .andExpect(status().isForbidden());
        mvc.perform(get(QUEUE)).andExpect(status().isUnauthorized());
    }

    private String upload() {
        var bytes = new byte[16];
        ThreadLocalRandom.current().nextBytes(bytes);
        var avatarKey = userId + "/" + HexFormat.of().formatHex(bytes) + ".jpg";
        transactions.executeWithoutResult(status -> profiles.setAvatar(userId, avatarKey));
        return avatarKey;
    }

    private ResultActions review(String avatarKey) throws Exception {
        return mvc.perform(put("/api/users/" + userId + "/avatar/review")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"avatarKey\":\"" + avatarKey + "\"}")
                .with(tokenWith("moderator")));
    }

    private static JwtRequestPostProcessor tokenWith(String role) {
        return jwt().jwt(builder -> builder.subject(UUID.randomUUID().toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }
}
