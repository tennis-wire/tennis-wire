package com.tenniswire.user_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.matchesPattern;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tenniswire.user_service.client.AvatarStorage;
import com.tenniswire.user_service.exception.StorageUnavailableException;
import com.tenniswire.user_service.repository.ProfileRepository;
import com.tenniswire.user_service.service.IdentityService;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class AvatarIT {

    private static final String AVATAR = "/api/users/me/avatar";
    private static final String OBJECT_PATH = "[0-9a-f-]{36}/[0-9a-f]{32}\\.jpg";

    @MockitoBean
    private AvatarStorage storage;

    @Autowired
    private IdentityService identities;

    @Autowired
    private ProfileRepository profiles;

    private MockMvc mvc;
    private String subject;
    private UUID userId;

    @BeforeEach
    void aReader(@Autowired WebApplicationContext context) {
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();
        subject = UUID.randomUUID().toString();
        userId = identities.resolve("keycloak", subject);
    }

    @Test
    void anUploadGivesBothSizesUnderOneKey() throws Exception {
        mvc.perform(multipart(AVATAR).file(png()).with(reader()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarUrl")
                        .value(matchesPattern("http://localhost:9000/avatars/96/" + OBJECT_PATH), String.class))
                .andExpect(jsonPath("$.avatarLargeUrl")
                        .value(matchesPattern("http://localhost:9000/avatars/288/" + OBJECT_PATH), String.class));

        var key = avatarKey();
        assertThat(key).startsWith(userId + "/");
        verify(storage).put(eq("96/" + key), any());
        verify(storage).put(eq("288/" + key), any());
        verify(storage, times(2)).put(any(), any());
    }

    @Test
    void theAvatarIsOnTheProfileAndInTheLookup() throws Exception {
        mvc.perform(multipart(AVATAR).file(png()).with(reader())).andExpect(status().isOk());
        var key = avatarKey();

        mvc.perform(get("/api/users/" + userId))
                .andExpect(jsonPath("$.avatarUrl").value("http://localhost:9000/avatars/96/" + key))
                .andExpect(jsonPath("$.avatarLargeUrl").value("http://localhost:9000/avatars/288/" + key));
        mvc.perform(get("/internal/users").param("ids", userId.toString()).with(tokenWith("service")))
                .andExpect(jsonPath("$[0].avatarUrl").value("http://localhost:9000/avatars/96/" + key))
                .andExpect(jsonPath("$[0].avatarLargeUrl").doesNotExist());
    }

    @Test
    void aNewAvatarTakesTheOldOneOutOfTheBucket() throws Exception {
        mvc.perform(multipart(AVATAR).file(png()).with(reader())).andExpect(status().isOk());
        var old = avatarKey();

        mvc.perform(multipart(AVATAR).file(png()).with(reader())).andExpect(status().isOk());

        assertThat(avatarKey()).isNotEqualTo(old);
        verify(storage).delete("96/" + old);
        verify(storage).delete("288/" + old);
        verify(storage, times(2)).delete(any());
    }

    @Test
    void removingEmptiesTheProfileAndTheBucket() throws Exception {
        mvc.perform(multipart(AVATAR).file(png()).with(reader())).andExpect(status().isOk());
        var key = avatarKey();

        mvc.perform(delete(AVATAR).with(reader())).andExpect(status().isNoContent());

        assertThat(avatarKey()).isNull();
        verify(storage).delete("96/" + key);
        verify(storage).delete("288/" + key);
        mvc.perform(get("/api/users/me").with(reader()))
                .andExpect(jsonPath("$.avatarUrl").isEmpty());
    }

    @Test
    void removingWhatIsNotThereIsFine() throws Exception {
        mvc.perform(delete(AVATAR).with(reader())).andExpect(status().isNoContent());

        verify(storage, never()).delete(any());
    }

    @Test
    void somethingThatIsNotAnImageIsRefusedBeforeTheBucket() throws Exception {
        var text =
                new MockMultipartFile("file", "a.png", "image/png", "not an image".getBytes(StandardCharsets.US_ASCII));

        mvc.perform(multipart(AVATAR).file(text).with(reader()))
                .andExpect(status().is(422))
                .andExpect(jsonPath("$.error").value("IMAGE_UNSUPPORTED"));

        verify(storage, never()).put(any(), any());
    }

    @Test
    void noFileIsABadRequest() throws Exception {
        mvc.perform(multipart(AVATAR).with(reader()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("BAD_REQUEST"));
    }

    @Test
    void aBucketThatDoesNotAnswerLeavesTheProfileAsItWas() throws Exception {
        doThrow(new StorageUnavailableException("down")).when(storage).put(startsWith("288/"), any());

        mvc.perform(multipart(AVATAR).file(png()).with(reader()))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("SERVICE_UNAVAILABLE"));

        assertThat(avatarKey()).isNull();
        // whatever did go in is taken back out
        verify(storage).delete(startsWith("96/"));
        verify(storage).delete(startsWith("288/"));
    }

    @Test
    void anAvatarIsAReadersOwn() throws Exception {
        mvc.perform(multipart(AVATAR).file(png())).andExpect(status().isUnauthorized());
        mvc.perform(multipart(AVATAR).file(png()).with(tokenWith("service"))).andExpect(status().isForbidden());
        mvc.perform(delete(AVATAR).with(tokenWith("service"))).andExpect(status().isForbidden());
    }

    private String avatarKey() {
        return profiles.findById(userId).orElseThrow().avatarKey();
    }

    private JwtRequestPostProcessor reader() {
        return jwt().jwt(builder -> builder.subject(subject)).authorities(new SimpleGrantedAuthority("ROLE_user"));
    }

    private static JwtRequestPostProcessor tokenWith(String role) {
        return jwt().jwt(builder -> builder.subject(UUID.randomUUID().toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }

    private static MockMultipartFile png() throws IOException {
        var image = new BufferedImage(300, 300, BufferedImage.TYPE_INT_RGB);
        var g = image.createGraphics();
        g.setColor(Color.ORANGE);
        g.fillRect(0, 0, 300, 300);
        g.dispose();
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(image, "png", bytes);
        return new MockMultipartFile("file", "avatar.png", "image/png", bytes.toByteArray());
    }
}
