package com.tenniswire.aggregator_service;

import static com.tenniswire.aggregator_service.Collector.batch;
import static com.tenniswire.aggregator_service.Collector.collector;
import static com.tenniswire.aggregator_service.Collector.items;
import static com.tenniswire.aggregator_service.Collector.newItem;
import static com.tenniswire.aggregator_service.Collector.sourceList;
import static com.tenniswire.aggregator_service.Collector.sources;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tenniswire.aggregator_service.entity.Extraction;
import com.tenniswire.aggregator_service.entity.Item;
import com.tenniswire.aggregator_service.repository.ItemRepository;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class IngestIT {

    @Autowired
    private ItemRepository itemRepository;

    private MockMvc mvc;
    private String source;
    private String other;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) throws Exception {
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();
        source = "src-" + UUID.randomUUID().toString().substring(0, 8);
        other = "other-" + UUID.randomUUID().toString().substring(0, 8);
        mvc.perform(sources(sourceList(source, other)).with(collector())).andExpect(status().isNoContent());
    }

    private String url() {
        return "https://" + source + ".example.com/tennis/" + UUID.randomUUID();
    }

    private Item stored(String url) {
        return itemRepository.findByUrl(url).orElseThrow();
    }

    @Test
    void aNewItemIsCreatedWithEverythingItBrought() throws Exception {
        var url = url();

        mvc.perform(items(batch(newItem(source, url, "Djokovic wins"))).with(collector()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results[0].url").value(url))
                .andExpect(jsonPath("$.results[0].outcome").value("created"));

        var item = stored(url);
        assertThat(item.sourceKey()).isEqualTo(source);
        assertThat(item.title()).isEqualTo("Djokovic wins");
        assertThat(item.titleBefore()).isNull();
        assertThat(item.lead()).isEqualTo("Lead of Djokovic wins");
        assertThat(item.text()).isNull();
        assertThat(item.firstSeenAt()).isEqualTo(Instant.parse("2026-10-12T10:01:00Z"));
        assertThat(item.categories()).containsExactly("ATP");
        assertThat(item.extraction()).isEqualTo(Extraction.FAILED);
        assertThat(item.extractionError()).isEqualTo("page answered 503");
        assertThat(item.createdAt()).isNotNull();
    }

    @Test
    void sendingTheSameItemAgainMakesNoDuplicate() throws Exception {
        var url = url();
        var item = newItem(source, url, "Djokovic wins");

        mvc.perform(items(batch(item)).with(collector())).andExpect(status().isOk());
        mvc.perform(items(batch(item)).with(collector()))
                .andExpect(jsonPath("$.results[0].outcome").value("updated"));

        assertThat(itemRepository.findAll().stream().filter(i -> i.url().equals(url)))
                .hasSize(1);
        assertThat(stored(url).titleBefore()).isNull();
    }

    @Test
    void anUpdateBringsTheTextAndKeepsWhatItDidNotBring() throws Exception {
        var url = url();
        mvc.perform(items(batch(newItem(source, url, "Djokovic wins"))).with(collector()));

        var update = """
                {"change": "update", "url": "%s", "text": "The final went the distance.", \
                 "extraction": "ok"}""".formatted(url);
        mvc.perform(items(batch(update)).with(collector()))
                .andExpect(jsonPath("$.results[0].outcome").value("updated"));

        var item = stored(url);
        assertThat(item.text()).isEqualTo("The final went the distance.");
        assertThat(item.extraction()).isEqualTo(Extraction.OK);
        assertThat(item.extractionError()).isNull();
        assertThat(item.title()).isEqualTo("Djokovic wins");
        assertThat(item.lead()).isEqualTo("Lead of Djokovic wins");
        assertThat(item.categories()).containsExactly("ATP");
    }

    @Test
    void aChangedTitleKeepsTheOneBefore() throws Exception {
        var url = url();
        mvc.perform(items(batch(newItem(source, url, "Djokovic wins"))).with(collector()));

        var update = """
                {"change": "update", "url": "%s", "title": "Djokovic wins a seventh title"}""".formatted(url);
        mvc.perform(items(batch(update)).with(collector()));

        var item = stored(url);
        assertThat(item.title()).isEqualTo("Djokovic wins a seventh title");
        assertThat(item.titleBefore()).isEqualTo("Djokovic wins");
    }

    @Test
    void anUpdateOfADeletedItemIsIgnored() throws Exception {
        var url = url();
        mvc.perform(items(batch(newItem(source, url, "Djokovic wins"))).with(collector()));
        itemRepository.delete(stored(url));

        var update = """
                {"change": "update", "url": "%s", "text": "Too late.", "extraction": "ok"}""".formatted(url);
        mvc.perform(items(batch(update)).with(collector()))
                .andExpect(jsonPath("$.results[0].outcome").value("ignored"));

        assertThat(itemRepository.findByUrl(url)).isEmpty();
    }

    @Test
    void theSameAddressFromAnotherSourceStaysWithTheFirst() throws Exception {
        var url = url();
        mvc.perform(items(batch(newItem(source, url, "Djokovic wins"))).with(collector()));

        mvc.perform(items(batch(newItem(other, url, "Djokovic wins"))).with(collector()))
                .andExpect(jsonPath("$.results[0].outcome").value("updated"));

        assertThat(stored(url).sourceKey()).isEqualTo(source);
    }

    @Test
    void aBadItemIsRejectedAndTheRestGoIn() throws Exception {
        var good = url();
        var unknownSource = url();
        var noScheme = """
                {"change": "new", "url": "javascript:alert(1)", "source": "%s", "externalId": "x", \
                 "title": "T", "firstSeenAt": "2026-10-12T10:00:00Z", "language": "en", \
                 "extraction": "skipped"}""".formatted(source);
        var missing = """
                {"change": "new", "url": "%s", "source": "%s"}""".formatted(url(), source);
        var tooLong = """
                {"change": "update", "url": "%s", "text": "%s"}""".formatted(url(), "x".repeat(200_001));

        mvc.perform(items(batch(
                                newItem(source, good, "Good"),
                                newItem("no-such-source", unknownSource, "Orphan"),
                                noScheme,
                                missing,
                                tooLong))
                        .with(collector()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results[0].outcome").value("created"))
                .andExpect(jsonPath("$.results[1].outcome").value("rejected"))
                .andExpect(jsonPath("$.results[1].reason").value("unknown source no-such-source"))
                .andExpect(jsonPath("$.results[2].outcome").value("rejected"))
                .andExpect(jsonPath("$.results[2].reason").value("url must be an absolute http or https address"))
                .andExpect(jsonPath("$.results[3].outcome").value("rejected"))
                .andExpect(jsonPath("$.results[3].reason")
                        .value("a new item needs externalId, title, firstSeenAt, language, extraction"))
                .andExpect(jsonPath("$.results[4].outcome").value("rejected"));

        assertThat(itemRepository.findByUrl(good)).isPresent();
        assertThat(itemRepository.findByUrl(unknownSource)).isEmpty();
    }

    @Test
    void aBatchIsAHundredAtMost() throws Exception {
        var many = new String[101];
        for (var i = 0; i < many.length; i++) {
            many[i] = newItem(source, url(), "T" + i);
        }

        mvc.perform(items(batch(many)).with(collector())).andExpect(status().isBadRequest());
    }

    @Test
    void anUnknownChangeIsABadRequest() throws Exception {
        var item = """
                {"change": "delete", "url": "%s"}""".formatted(url());

        mvc.perform(items(batch(item)).with(collector())).andExpect(status().isBadRequest());
    }

    @Test
    void anEmptyBatchIsFine() throws Exception {
        mvc.perform(items(batch()).with(collector()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results").isEmpty());
    }
}
