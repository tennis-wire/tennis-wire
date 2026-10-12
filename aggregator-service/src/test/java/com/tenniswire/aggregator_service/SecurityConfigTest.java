package com.tenniswire.aggregator_service;

import static com.tenniswire.aggregator_service.Collector.batch;
import static com.tenniswire.aggregator_service.Collector.collector;
import static com.tenniswire.aggregator_service.Collector.items;
import static com.tenniswire.aggregator_service.Collector.tokenWith;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
class SecurityConfigTest {

    private MockMvc mvc;

    @BeforeEach
    void bindToChain(@Autowired WebApplicationContext context) {
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();
    }

    @Test
    void internalNeedsAToken() throws Exception {
        mvc.perform(items(batch())).andExpect(status().isUnauthorized());
    }

    @Test
    void internalIsTheCollectorsAlone() throws Exception {
        // service opens the /internal/** of user-service and discussion-service, not this one
        for (var role : new String[] {"service", "author", "admin", "user"}) {
            mvc.perform(items(batch()).with(tokenWith(role))).andExpect(status().isForbidden());
        }
        mvc.perform(items(batch()).with(collector())).andExpect(status().isOk());
    }

    @Test
    void everythingElseIsClosed() throws Exception {
        // The newsroom's API comes with part 3; until then no path but /internal/** is open
        mvc.perform(get("/api/aggregator/items").with(tokenWith("author"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/aggregator/items").with(collector())).andExpect(status().isForbidden());
    }
}
