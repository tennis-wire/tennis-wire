package com.tenniswire.aggregator_service;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

// Requests as the collector sends them: its token, its JSON
final class Collector {

    private Collector() {}

    static JwtRequestPostProcessor tokenWith(String role) {
        return jwt().jwt(builder -> builder.subject("service-account-parsing-service"))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }

    static JwtRequestPostProcessor collector() {
        return tokenWith("parser");
    }

    static MockHttpServletRequestBuilder sources(String json) {
        return put("/internal/sources").contentType(MediaType.APPLICATION_JSON).content(json);
    }

    static MockHttpServletRequestBuilder items(String json) {
        return post("/internal/items").contentType(MediaType.APPLICATION_JSON).content(json);
    }

    static String source(String key) {
        return """
                {"key": "%s", "name": "Source %s", "language": "en", "siteUrl": "https://%s.example.com/"}""".formatted(key, key, key);
    }

    static String sourceList(String... keys) {
        return "{\"sources\": ["
                + String.join(
                        ", ",
                        java.util.Arrays.stream(keys).map(Collector::source).toList()) + "]}";
    }

    static String newItem(String source, String url, String title) {
        return """
                {"change": "new", "url": "%s", "source": "%s", "externalId": "%s", "title": "%s", \
                 "lead": "Lead of %s", "text": null, "author": "A. Writer", \
                 "publishedAt": "2026-10-12T10:00:00Z", "firstSeenAt": "2026-10-12T10:01:00Z", \
                 "language": "en", "categories": ["ATP"], "embeds": [], \
                 "extraction": "failed", "extractionError": "page answered 503"}""".formatted(url, source, url, title, title);
    }

    static String batch(String... items) {
        return "{\"items\": [" + String.join(", ", items) + "]}";
    }
}
