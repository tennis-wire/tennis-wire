package com.tenniswire.content_service.media;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.notFound;
import static com.github.tomakehurst.wiremock.client.WireMock.ok;
import static com.github.tomakehurst.wiremock.client.WireMock.temporaryRedirect;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.options;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.github.tomakehurst.wiremock.WireMockServer;
import com.tenniswire.content_service.config.MediaProperties;
import com.tenniswire.content_service.exception.ImageLinkException;
import com.tenniswire.content_service.exception.ImageLinkException.Reason;
import java.time.Duration;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.util.unit.DataSize;

class RemoteImageFetcherTest {

    private static final WireMockServer SITE = new WireMockServer(options().dynamicPort());

    // a local server, so local addresses are let through; the guard itself is tested below
    private final RemoteImageFetcher fetcher = fetcher(true, Duration.ofSeconds(2));

    @BeforeAll
    static void start() {
        SITE.start();
    }

    @AfterAll
    static void stop() {
        SITE.stop();
    }

    @BeforeEach
    void reset() {
        SITE.resetAll();
    }

    private static RemoteImageFetcher fetcher(boolean allowLocal, Duration timeout) {
        var remote = new MediaProperties.Remote(DataSize.ofKilobytes(1), timeout, allowLocal);
        return new RemoteImageFetcher(new MediaProperties(null, 0, null, remote));
    }

    private static String link(String path) {
        return SITE.baseUrl() + path;
    }

    @Test
    void takesThePictureBehindTheLink() {
        var png = TestImages.png(4, 3);
        SITE.stubFor(get(urlPathEqualTo("/a.png")).willReturn(ok().withBody(png)));

        assertThat(fetcher.fetch(link("/a.png"))).isEqualTo(png);
    }

    @Test
    void followsAFewRedirectsAndNoMore() {
        var png = TestImages.png(4, 3);
        SITE.stubFor(get(urlPathEqualTo("/old")).willReturn(temporaryRedirect("/new")));
        SITE.stubFor(get(urlPathEqualTo("/new")).willReturn(ok().withBody(png)));
        SITE.stubFor(get(urlPathEqualTo("/loop")).willReturn(temporaryRedirect("/loop")));

        assertThat(fetcher.fetch(link("/old"))).isEqualTo(png);
        assertRefused(link("/loop"), Reason.LINK_REFUSED);
    }

    @Test
    void checksWhereARedirectLeads() {
        SITE.stubFor(get(urlPathEqualTo("/away")).willReturn(temporaryRedirect("file:///etc/passwd")));

        assertRefused(link("/away"), Reason.BAD_LINK);
    }

    @Test
    void saysSoWhenTheSiteRefuses() {
        SITE.stubFor(get(urlPathEqualTo("/gone")).willReturn(notFound()));

        assertRefused(link("/gone"), Reason.LINK_REFUSED);
    }

    @Test
    void stopsAtTheSizeLimitWhateverTheSiteDeclares() {
        var big = new byte[2048];
        SITE.stubFor(get(urlPathEqualTo("/declared")).willReturn(ok().withBody(big)));
        SITE.stubFor(
                get(urlPathEqualTo("/chunked")).willReturn(ok().withBody(big).withChunkedDribbleDelay(4, 10)));

        assertRefused(link("/declared"), Reason.LINK_TOO_LARGE);
        assertRefused(link("/chunked"), Reason.LINK_TOO_LARGE);
    }

    @Test
    void givesUpOnASiteThatDoesNotAnswer() {
        SITE.stubFor(get(urlPathEqualTo("/slow")).willReturn(aResponse().withFixedDelay(3000)));

        assertRefused(fetcher(true, Duration.ofMillis(500)), link("/slow"), Reason.LINK_UNREACHABLE);
    }

    @Test
    void takesNothingButAnHttpLinkToAHost() {
        for (var link : new String[] {
            "file:///etc/passwd", "ftp://example.com/a.png", "https://user:pass@example.com/a.png", "not a link", ""
        }) {
            assertRefused(link, Reason.BAD_LINK);
        }
    }

    @Test
    void goesNowhereButOutOnTheInternet() {
        var guarded = fetcher(false, Duration.ofSeconds(2));

        assertRefused(guarded, "http://127.0.0.1/a.png", Reason.LOCAL_ADDRESS);
        assertRefused(guarded, "http://localhost/a.png", Reason.LOCAL_ADDRESS);
        assertRefused(guarded, "http://169.254.169.254/latest/meta-data/", Reason.LOCAL_ADDRESS);
        assertRefused(guarded, "http://[::1]/a.png", Reason.LOCAL_ADDRESS);
        // a service on its own port is not reached by naming the port
        assertRefused(guarded, "http://example.com:5432/", Reason.BAD_LINK);
    }

    private void assertRefused(String link, Reason reason) {
        assertRefused(fetcher, link, reason);
    }

    private static void assertRefused(RemoteImageFetcher fetcher, String link, Reason reason) {
        assertThatThrownBy(() -> fetcher.fetch(link))
                .as(link)
                .isInstanceOfSatisfying(
                        ImageLinkException.class, e -> assertThat(e.reason()).isEqualTo(reason));
    }
}
