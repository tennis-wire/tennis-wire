package com.tenniswire.user_service;

import static org.hamcrest.Matchers.startsWith;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tenniswire.user_service.entity.Profile;
import com.tenniswire.user_service.repository.ProfileRepository;
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
class ReaderProfileIT {

    @Autowired
    private ProfileRepository profiles;

    private MockMvc mvc;

    @BeforeEach
    void bindToChain(@Autowired WebApplicationContext context) {
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();
    }

    @Test
    void theProfileCarriesTheNameTheDateAndNothingElse() throws Exception {
        var profile = new Profile();
        profile.displayName("reader-" + UUID.randomUUID());
        var saved = profiles.saveAndFlush(profile);

        mvc.perform(get("/api/users/" + saved.userId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(saved.userId().toString()))
                .andExpect(jsonPath("$.displayName").value(startsWith("reader-"), String.class))
                .andExpect(jsonPath("$.createdAt").isNotEmpty())
                // on the wire before there is anything to put in it
                .andExpect(jsonPath("$.avatarUrl").isEmpty())
                .andExpect(jsonPath("$.avatarLargeUrl").isEmpty())
                // nothing of his own: the reader's page shows what everyone is shown
                .andExpect(jsonPath("$.displayNameChosen").doesNotExist())
                .andExpect(jsonPath("$.updatedAt").doesNotExist());
    }

    @Test
    void anIdNobodyHasIsNotFound() throws Exception {
        mvc.perform(get("/api/users/" + UUID.randomUUID()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("NOT_FOUND"));
    }
}
