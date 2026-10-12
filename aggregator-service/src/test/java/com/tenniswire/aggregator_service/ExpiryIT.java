package com.tenniswire.aggregator_service;

import static com.tenniswire.aggregator_service.Collector.batch;
import static com.tenniswire.aggregator_service.Collector.collector;
import static com.tenniswire.aggregator_service.Collector.items;
import static com.tenniswire.aggregator_service.Collector.newItem;
import static com.tenniswire.aggregator_service.Collector.sourceList;
import static com.tenniswire.aggregator_service.Collector.sources;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;

import com.tenniswire.aggregator_service.config.ExpiryProperties;
import com.tenniswire.aggregator_service.repository.ItemRepository;
import com.tenniswire.aggregator_service.service.ExpiryJob;
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

// The job is switched off in the test profile and driven by hand here; a small batch makes the pass
// go round its loop
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@TestPropertySource(properties = {"aggregator.expiry.enabled=true", "aggregator.expiry.batch-size=2"})
class ExpiryIT {

    @Autowired
    private ExpiryJob job;

    @Autowired
    private ExpiryProperties properties;

    @Autowired
    private ItemRepository itemRepository;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void itemsPastTheirTermGoWholeAndTheRestStay(@Autowired WebApplicationContext context) throws Exception {
        var mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();
        var source = "exp-" + UUID.randomUUID().toString().substring(0, 8);
        mvc.perform(sources(sourceList(source)).with(collector()));
        var old = new String[] {url(source), url(source), url(source)};
        var fresh = url(source);
        for (var url : old) {
            mvc.perform(items(batch(newItem(source, url, "Old"))).with(collector()));
            jdbc.update(
                    "update item set created_at = now() - ?::interval where url = ?",
                    properties.after().plus(Duration.ofHours(1)).toSeconds() + " seconds",
                    url);
        }
        mvc.perform(items(batch(newItem(source, fresh, "Fresh"))).with(collector()));

        job.pass();

        for (var url : old) {
            assertThat(itemRepository.findByUrl(url)).isEmpty();
        }
        assertThat(itemRepository.findByUrl(fresh)).isPresent();
    }

    private static String url(String source) {
        return "https://" + source + ".example.com/" + UUID.randomUUID();
    }
}
