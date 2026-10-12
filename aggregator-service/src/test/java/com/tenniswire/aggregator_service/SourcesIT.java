package com.tenniswire.aggregator_service;

import static com.tenniswire.aggregator_service.Collector.collector;
import static com.tenniswire.aggregator_service.Collector.sourceList;
import static com.tenniswire.aggregator_service.Collector.sources;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tenniswire.aggregator_service.repository.SourceRepository;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class SourcesIT {

    @Autowired
    private SourceRepository sourceRepository;

    private MockMvc mvc;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();
    }

    private static String key(String name) {
        return name + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    @Test
    void theListRegistersRetiresAndBringsBack() throws Exception {
        var kept = key("kept");
        var dropped = key("dropped");

        mvc.perform(sources(sourceList(kept, dropped)).with(collector())).andExpect(status().isNoContent());
        assertThat(sourceRepository.findById(dropped).orElseThrow().retired()).isFalse();
        assertThat(sourceRepository.findById(kept).orElseThrow().name()).isEqualTo("Source " + kept);

        mvc.perform(sources(sourceList(kept)).with(collector())).andExpect(status().isNoContent());
        assertThat(sourceRepository.findById(dropped).orElseThrow().retired()).isTrue();
        assertThat(sourceRepository.findById(kept).orElseThrow().retired()).isFalse();

        mvc.perform(sources(sourceList(kept, dropped)).with(collector())).andExpect(status().isNoContent());
        assertThat(sourceRepository.findById(dropped).orElseThrow().retired()).isFalse();
    }

    @Test
    void anEmptyListIsRefused() throws Exception {
        // It would retire everything: a broken collector, not a decision
        mvc.perform(sources("{\"sources\": []}").with(collector())).andExpect(status().isBadRequest());
    }

    @Test
    void aMalformedSourceIsRefused() throws Exception {
        var bad = """
                {"sources": [{"key": "Bad Key", "name": "N", "language": "english", "siteUrl": "ftp://x"}]}""";

        mvc.perform(sources(bad).with(collector())).andExpect(status().isBadRequest());
    }

    @Test
    void theHealthSnapshotIsKeptAsItCame() throws Exception {
        var source = key("blocked");
        mvc.perform(sources(sourceList(source)).with(collector()));
        var snapshot = """
                {"problems": [{"kind": "blocked", "detail": "challenge since 2026-10-12T08:00:00+00:00"}], \
                 "lastRunAt": "2026-10-12T10:00:00Z", "lastStatus": "blocked", \
                 "lastOkAt": "2026-10-12T07:59:00Z", "lastNewAt": "2026-10-12T07:30:00Z", \
                 "failuresInRow": 12, "blockedSince": "2026-10-12T08:00:00Z", "blockKind": "challenge"}""";

        mvc.perform(health(source, snapshot)).andExpect(status().isNoContent());

        var stored = sourceRepository.findById(source).orElseThrow();
        assertThat(stored.health().problems()).hasSize(1);
        assertThat(stored.health().problems().getFirst().kind()).isEqualTo("blocked");
        assertThat(stored.health().failuresInRow()).isEqualTo(12);
        assertThat(stored.health().blockedSince()).isEqualTo(Instant.parse("2026-10-12T08:00:00Z"));
        assertThat(stored.healthAt()).isNotNull();
    }

    @Test
    void healthOfAnUnknownSourceIsNotFound() throws Exception {
        mvc.perform(health("no-such-source", "{\"problems\": [], \"failuresInRow\": 0}"))
                .andExpect(status().isNotFound());
    }

    private static org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder health(
            String source, String json) {
        return put("/internal/sources/{key}/health", source)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json)
                .with(collector());
    }
}
