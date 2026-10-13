package com.tenniswire.aggregator_service;

import static com.tenniswire.aggregator_service.Collector.batch;
import static com.tenniswire.aggregator_service.Collector.collector;
import static com.tenniswire.aggregator_service.Collector.items;
import static com.tenniswire.aggregator_service.Collector.newItem;
import static com.tenniswire.aggregator_service.Collector.sourceList;
import static com.tenniswire.aggregator_service.Collector.sources;
import static com.tenniswire.aggregator_service.Collector.tokenWith;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.tenniswire.aggregator_service.repository.ItemRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class EditorialIT {

    @Autowired
    private ItemRepository itemRepository;

    private MockMvc mvc;
    private String source;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) throws Exception {
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();
        source = "feed-" + UUID.randomUUID().toString().substring(0, 8);
        mvc.perform(sources(sourceList(source)).with(collector())).andExpect(status().isNoContent());
    }

    private String url(String name) {
        return "https://" + source + ".example.com/" + name;
    }

    private void arrive(String... names) throws Exception {
        var json = java.util.Arrays.stream(names)
                .map(name -> newItem(source, url(name), "Title " + name))
                .toArray(String[]::new);
        mvc.perform(items(batch(json)).with(collector())).andExpect(status().isOk());
    }

    private static MockHttpServletRequestBuilder asAuthor(MockHttpServletRequestBuilder request) {
        return request.with(tokenWith("author"));
    }

    // Pairs of name and value; each name may repeat
    private List<String> titles(String... params) throws Exception {
        var request = get("/api/aggregator/items").param("source", source);
        for (var i = 0; i < params.length; i += 2) {
            request.param(params[i], params[i + 1]);
        }
        var body = mvc.perform(asAuthor(request))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return JsonPath.read(body, "$.items[*].title");
    }

    @Test
    void theFeedIsNewestArrivalFirstInPagesThatDoNotShift() throws Exception {
        arrive("a");
        // One batch, one transaction: the same arrival time, the id breaks the tie
        arrive("b", "c", "d");
        arrive("e");

        var seen = new ArrayList<String>();
        String cursor = null;
        do {
            var query = "source=" + source + "&limit=2" + (cursor == null ? "" : "&cursor=" + cursor);
            var body = mvc.perform(asAuthor(get("/api/aggregator/items?" + query)))
                    .andExpect(status().isOk())
                    .andReturn()
                    .getResponse()
                    .getContentAsString();
            seen.addAll(JsonPath.<List<String>>read(body, "$.items[*].title"));
            cursor = JsonPath.read(body, "$.nextCursor");
            if (seen.size() == 2) {
                // Arrived while the feed was open: above the first page, not into the next one
                arrive("late");
            }
        } while (cursor != null);

        assertThat(seen).hasSize(5).doesNotHaveDuplicates();
        assertThat(seen.getFirst()).isEqualTo("Title e");
        assertThat(seen.getLast()).isEqualTo("Title a");
        assertThat(seen.subList(1, 4)).containsExactlyInAnyOrder("Title b", "Title c", "Title d");
    }

    @Test
    void filtersAndSearch() throws Exception {
        arrive("sinner", "alcaraz");

        assertThat(titles("search", "SINN")).containsExactly("Title sinner");
        // The lead is searched too: "Lead of Title alcaraz"
        assertThat(titles("search", "lead of title alc")).containsExactly("Title alcaraz");
        // LIKE wildcards are plain characters
        assertThat(titles("search", "%")).isEmpty();
        assertThat(titles("search", "_")).isEmpty();
        assertThat(titles("language", "fr")).isEmpty();
        assertThat(titles("language", "fr", "language", "en")).hasSize(2);
    }

    @Test
    void anItemWholeByIdAndByAddress() throws Exception {
        arrive("whole");
        var id = itemRepository.findByUrl(url("whole")).orElseThrow().id();

        mvc.perform(asAuthor(get("/api/aggregator/items/{id}", id)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value(url("whole")))
                .andExpect(jsonPath("$.source").value(source))
                .andExpect(jsonPath("$.categories[0]").value("ATP"))
                .andExpect(jsonPath("$.extraction").value("failed"));
        mvc.perform(asAuthor(get("/api/aggregator/items/by-url").param("url", url("whole"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id.toString()));
        mvc.perform(asAuthor(get("/api/aggregator/items/by-url").param("url", url("gone"))))
                .andExpect(status().isNotFound());
    }

    @Test
    void deletingIsWholeAndAgainIsNoError() throws Exception {
        arrive("cleared");
        var id = itemRepository.findByUrl(url("cleared")).orElseThrow().id();

        mvc.perform(asAuthor(delete("/api/aggregator/items/{id}", id))).andExpect(status().isNoContent());
        mvc.perform(asAuthor(delete("/api/aggregator/items/{id}", id))).andExpect(status().isNoContent());

        assertThat(itemRepository.findById(id)).isEmpty();
        mvc.perform(asAuthor(get("/api/aggregator/items/{id}", id))).andExpect(status().isNotFound());
    }

    @Test
    void sourcesComeWithTheirHealth() throws Exception {
        mvc.perform(asAuthor(get("/api/aggregator/sources")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.key == '%s')].name", source).value("Source " + source))
                .andExpect(jsonPath("$[?(@.key == '%s')].retired", source).value(false));
    }

    @Test
    void badParametersAreRefused() throws Exception {
        mvc.perform(asAuthor(get("/api/aggregator/items?cursor=not-ours"))).andExpect(status().isBadRequest());
        mvc.perform(asAuthor(get("/api/aggregator/items?limit=101"))).andExpect(status().isBadRequest());
        mvc.perform(asAuthor(get("/api/aggregator/items/not-a-uuid"))).andExpect(status().isBadRequest());
    }
}
