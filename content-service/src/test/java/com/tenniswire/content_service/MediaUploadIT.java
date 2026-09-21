package com.tenniswire.content_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.endsWith;
import static org.hamcrest.Matchers.startsWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tenniswire.content_service.exception.StorageUnavailableException;
import com.tenniswire.content_service.media.MediaStorage;
import com.tenniswire.content_service.media.TestImages;
import com.tenniswire.content_service.repository.MediaRepository;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class MediaUploadIT {

    private static final String UPLOAD = "/api/editorial/media/images";

    @MockitoBean
    private MediaStorage storage;

    @Autowired
    private MediaRepository media;

    private MockMvc mvc;

    @BeforeEach
    void bind(@Autowired WebApplicationContext context) {
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();
    }

    private static RequestPostProcessor author() {
        return jwt().authorities(new SimpleGrantedAuthority("ROLE_author"));
    }

    @Test
    void anImageGetsAPublicUrlAndARow() throws Exception {
        var file = new MockMultipartFile("file", "cover.png", "image/png", TestImages.png(64, 48));

        mvc.perform(multipart(UPLOAD).file(file).with(author()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.url").value(startsWith("http://localhost:9000/media/")))
                .andExpect(jsonPath("$.url").value(endsWith(".png")))
                .andExpect(jsonPath("$.mimeType").value("image/png"))
                .andExpect(jsonPath("$.width").value(64))
                .andExpect(jsonPath("$.height").value(48));

        var key = ArgumentCaptor.forClass(String.class);
        var stored = ArgumentCaptor.forClass(byte[].class);
        verify(storage).put(key.capture(), stored.capture(), eq("image/png"));
        assertThat(TestImages.contains(stored.getValue(), TestImages.SECRET)).isFalse();
        assertThat(media.findAll()).anyMatch(row -> row.url().endsWith("/" + key.getValue()));
    }

    // named and typed as a picture by the client, which decides nothing
    @Test
    void whatIsNotAnImageIsRefusedBeforeItReachesTheStorage() throws Exception {
        var html = "<html><script>alert(1)</script></html>".getBytes(StandardCharsets.US_ASCII);
        var file = new MockMultipartFile("file", "cover.png", "image/png", html);

        mvc.perform(multipart(UPLOAD).file(file).with(author()))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.error").value("UNSUPPORTED_IMAGE"));

        verifyNoInteractions(storage);
    }

    @Test
    void aStorageThatIsDownIsReportedAndLeavesNoRow() throws Exception {
        doThrow(new StorageUnavailableException("down", new IllegalStateException()))
                .when(storage)
                .put(any(), any(), any());
        var before = media.count();
        var file = new MockMultipartFile("file", "cover.png", "image/png", TestImages.png(64, 48));

        mvc.perform(multipart(UPLOAD).file(file).with(author()))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("STORAGE_UNAVAILABLE"));

        assertThat(media.count()).isEqualTo(before);
    }

    @Test
    void uploadingNeedsTheAuthorRole() throws Exception {
        var file = new MockMultipartFile("file", "cover.png", "image/png", TestImages.png(64, 48));

        mvc.perform(multipart(UPLOAD).file(file)).andExpect(status().isUnauthorized());
        mvc.perform(multipart(UPLOAD).file(file).with(jwt().authorities(new SimpleGrantedAuthority("ROLE_user"))))
                .andExpect(status().isForbidden());
    }
}
