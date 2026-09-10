package com.tenniswire.user_service;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tenniswire.user_service.service.ProfileService;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class InternalUserControllerTest {

    private static final String LOOKUP = "/internal/users";

    private MockMvc mvc;

    @BeforeEach
    void bindToChain(@Autowired WebApplicationContext context) {
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();
    }

    private static JwtRequestPostProcessor serviceToken() {
        return jwt().jwt(builder -> builder.subject(UUID.randomUUID().toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_service"));
    }

    @Test
    void oneIdTooManyIsRejectedAsABadRequest() throws Exception {
        var ids = IntStream.range(0, ProfileService.MAX_LOOKUP_IDS + 1)
                .mapToObj(i -> UUID.randomUUID().toString())
                .toArray(String[]::new);

        mvc.perform(get(LOOKUP).param("ids", ids).with(serviceToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("BAD_REQUEST"));
    }

    @Test
    void theCapItselfIsAccepted() throws Exception {
        var ids = IntStream.range(0, ProfileService.MAX_LOOKUP_IDS)
                .mapToObj(i -> UUID.randomUUID().toString())
                .toArray(String[]::new);

        mvc.perform(get(LOOKUP).param("ids", ids).with(serviceToken())).andExpect(status().isOk());
    }

    @Test
    void anEmptyBatchIsRejected() throws Exception {
        mvc.perform(get(LOOKUP).param("ids", "").with(serviceToken())).andExpect(status().isBadRequest());
    }
}
