package com.tenniswire.content_service;

import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.notFound;
import static com.github.tomakehurst.wiremock.client.WireMock.ok;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.options;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.startsWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.github.tomakehurst.wiremock.WireMockServer;
import com.jayway.jsonpath.JsonPath;
import com.tenniswire.content_service.media.MediaStorage;
import com.tenniswire.content_service.media.TestImages;
import com.tenniswire.content_service.repository.MediaRepository;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

// The site is a server on this machine, so local addresses are let through here; that they are
// refused everywhere else is RemoteImageFetcherTest's to show
@SpringBootTest(properties = "media.remote.allow-local=true")
@Import(TestcontainersConfiguration.class)
class MediaImportIT {

    private static final String IMPORT = "/api/editorial/media/images/from-link";
    private static final WireMockServer SITE = new WireMockServer(options().dynamicPort());

    @MockitoBean
    private MediaStorage storage;

    @Autowired
    private MediaRepository media;

    private MockMvc mvc;

    @BeforeAll
    static void start() {
        SITE.start();
    }

    @AfterAll
    static void stop() {
        SITE.stop();
    }

    @BeforeEach
    void bind(@Autowired WebApplicationContext context) {
        SITE.resetAll();
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();
    }

    private ResultActions importFrom(String link) throws Exception {
        return mvc.perform(post(IMPORT)
                .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_author")))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"url\":\"" + link + "\"}"));
    }

    @Test
    void aPictureFromALinkIsKeptAsAnUploadIs() throws Exception {
        var link = SITE.baseUrl() + "/" + UUID.randomUUID() + ".png";
        SITE.stubFor(get(urlPathEqualTo(link.substring(SITE.baseUrl().length())))
                .willReturn(ok().withHeader("Content-Type", "application/octet-stream")
                        .withBody(TestImages.png(64, 48))));

        var answer = importFrom(link)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.url").value(startsWith("http://localhost:9000/media/")))
                .andExpect(jsonPath("$.mimeType").value("image/png"))
                .andExpect(jsonPath("$.width").value(64))
                .andReturn();

        verify(storage).put(anyString(), any(byte[].class), eq("image/png"));
        String url = JsonPath.read(answer.getResponse().getContentAsString(), "$.url");
        assertThat(media.findAll())
                .filteredOn(row -> row.url().equals(url))
                .singleElement()
                .satisfies(row -> assertThat(row.sourceUrl()).isEqualTo(link));
    }

    // what decides is the bytes, as for an upload; a page named like a picture is not one
    @Test
    void aPageIsNotAPicture() throws Exception {
        SITE.stubFor(get(urlPathEqualTo("/photo.jpg"))
                .willReturn(ok().withHeader("Content-Type", "image/jpeg").withBody("<html>nope</html>")));

        importFrom(SITE.baseUrl() + "/photo.jpg")
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.error").value("UNSUPPORTED_IMAGE"));
        verifyNoInteractions(storage);
    }

    @Test
    void whyNothingCameIsNamed() throws Exception {
        SITE.stubFor(get(urlPathEqualTo("/gone.png")).willReturn(notFound()));

        importFrom(SITE.baseUrl() + "/gone.png")
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.error").value("LINK_REFUSED"));
        importFrom("ftp://example.com/a.png")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("BAD_LINK"));
        verifyNoInteractions(storage);
    }
}
