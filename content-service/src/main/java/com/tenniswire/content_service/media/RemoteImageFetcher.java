package com.tenniswire.content_service.media;

import com.tenniswire.content_service.config.MediaProperties;
import com.tenniswire.content_service.exception.ImageLinkException;
import com.tenniswire.content_service.exception.ImageLinkException.Reason;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.Duration;
import java.util.Locale;
import java.util.Set;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.config.ConnectionConfig;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.core5.http.ClassicHttpResponse;
import org.apache.hc.core5.http.HttpHeaders;
import org.apache.hc.core5.io.CloseMode;
import org.apache.hc.core5.io.ModalCloseable;
import org.apache.hc.core5.util.Timeout;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.stereotype.Component;

// Takes a picture from a link an author gives, so that the article holds a copy of its own rather
// than a link that can rot, be swapped or be refused to our readers. Nothing about the link or
// the answer is trusted: the link is checked, every address it leads to must be public (see
// PublicAddressResolver), each redirect is checked again, and the body is cut off at the upload
// limit and at a deadline. Whether the bytes are a picture is ImageInspector's to say, as for an
// upload: the Content-Type of the answer decides nothing.
@Component
public class RemoteImageFetcher implements DisposableBean {

    private static final Set<String> SCHEMES = Set.of("http", "https");
    private static final Set<Integer> REDIRECTS = Set.of(301, 302, 303, 307, 308);
    private static final int MAX_REDIRECTS = 3;
    private static final int MAX_LINK_LENGTH = 2000;

    private final CloseableHttpClient client;
    private final long maxBytes;
    private final Duration deadline;
    private final boolean allowLocal;

    public RemoteImageFetcher(MediaProperties properties) {
        var remote = properties.remote();
        this.maxBytes = remote.maxSize().toBytes();
        this.deadline = remote.timeout();
        this.allowLocal = remote.allowLocal();
        var timeout = Timeout.of(remote.timeout());
        var connections = PoolingHttpClientConnectionManagerBuilder.create()
                .setDnsResolver(new PublicAddressResolver(allowLocal))
                .setDefaultConnectionConfig(ConnectionConfig.custom()
                        .setConnectTimeout(timeout)
                        .setSocketTimeout(timeout)
                        .build())
                .build();
        // No proxy from the environment, no cookies, no retries, and redirects by hand below
        this.client = HttpClients.custom()
                .setConnectionManager(connections)
                .setDefaultRequestConfig(
                        RequestConfig.custom().setResponseTimeout(timeout).build())
                .disableRedirectHandling()
                .disableCookieManagement()
                .disableAutomaticRetries()
                .disableAuthCaching()
                .setUserAgent("TennisWire/1.0 (picture import)")
                .build();
    }

    public byte[] fetch(String link) {
        var uri = checked(link);
        var until = System.nanoTime() + deadline.toNanos();
        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            var answer = get(uri, until);
            if (answer.body() != null) {
                return answer.body();
            }
            uri = checked(uri.resolve(answer.redirect()).toString());
        }
        throw new ImageLinkException(Reason.LINK_REFUSED, "More than %d redirects".formatted(MAX_REDIRECTS));
    }

    private record Answer(byte[] body, URI redirect) {}

    private Answer get(URI uri, long until) {
        var request = new HttpGet(uri);
        request.setHeader(HttpHeaders.ACCEPT, "image/avif,image/webp,image/png,image/jpeg,image/gif,image/*;q=0.8");
        ClassicHttpResponse response;
        try {
            response = client.executeOpen(null, request, null);
        } catch (PublicAddressResolver.LocalAddressException e) {
            throw new ImageLinkException(Reason.LOCAL_ADDRESS, e.getMessage(), e);
        } catch (IOException e) {
            throw new ImageLinkException(Reason.LINK_UNREACHABLE, "No answer from " + uri.getHost(), e);
        }
        try {
            return answerOf(response, until);
        } catch (IOException e) {
            throw new ImageLinkException(Reason.LINK_UNREACHABLE, "The answer from " + uri.getHost() + " broke off", e);
        } finally {
            closeNow(response);
        }
    }

    // A graceful close reads what is left of the body to keep the connection, and what is left may
    // never end. Connections are not kept anyway.
    private static void closeNow(ClassicHttpResponse response) {
        if (response instanceof ModalCloseable closeable) {
            closeable.close(CloseMode.IMMEDIATE);
        } else {
            try {
                response.close();
            } catch (IOException ignored) {
                // nothing is left to do with it
            }
        }
    }

    private Answer answerOf(ClassicHttpResponse response, long until) throws IOException {
        int status = response.getCode();
        if (REDIRECTS.contains(status)) {
            var location = response.getFirstHeader(HttpHeaders.LOCATION);
            if (location == null) {
                throw new ImageLinkException(Reason.LINK_REFUSED, "A redirect with no address");
            }
            return new Answer(null, toUri(location.getValue()));
        }
        var entity = response.getEntity();
        if (status != 200 || entity == null) {
            throw new ImageLinkException(Reason.LINK_REFUSED, "The site answered " + status);
        }
        if (entity.getContentLength() > maxBytes) {
            throw tooLarge();
        }
        // not closed here: closing the stream would read the rest of it, see closeNow
        return new Answer(read(entity.getContent(), until), null);
    }

    // The declared length may be absent or a lie: the count is kept here, and so is the clock,
    // since a site can trickle a byte at a time without ever tripping the socket timeout
    private byte[] read(InputStream in, long until) throws IOException {
        var out = new ByteArrayOutputStream();
        var buffer = new byte[8192];
        for (int n = in.read(buffer); n != -1; n = in.read(buffer)) {
            out.write(buffer, 0, n);
            if (out.size() > maxBytes) {
                throw tooLarge();
            }
            if (System.nanoTime() > until) {
                throw new ImageLinkException(Reason.LINK_UNREACHABLE, "The site is too slow");
            }
        }
        return out.toByteArray();
    }

    private ImageLinkException tooLarge() {
        return new ImageLinkException(Reason.LINK_TOO_LARGE, "The picture is larger than %d bytes".formatted(maxBytes));
    }

    // http or https, a host, no login, and the standard port, so that a link cannot aim at some
    // service by its port. A local test server is let through on any port.
    private URI checked(String link) {
        if (link == null || link.isBlank() || link.length() > MAX_LINK_LENGTH) {
            throw new ImageLinkException(Reason.BAD_LINK, "No link");
        }
        var uri = toUri(link.strip());
        var scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!SCHEMES.contains(scheme) || uri.getHost() == null || uri.getRawUserInfo() != null) {
            throw new ImageLinkException(Reason.BAD_LINK, "Only an http or https link to a host");
        }
        int port = uri.getPort();
        boolean standard = port == -1 || port == ("https".equals(scheme) ? 443 : 80);
        if (!standard && !allowLocal) {
            throw new ImageLinkException(Reason.BAD_LINK, "Only the standard port");
        }
        return uri;
    }

    private static URI toUri(String link) {
        try {
            return new URI(link);
        } catch (URISyntaxException e) {
            throw new ImageLinkException(Reason.BAD_LINK, "Not a link", e);
        }
    }

    @Override
    public void destroy() throws IOException {
        client.close();
    }
}
