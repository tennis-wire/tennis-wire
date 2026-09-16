package com.tenniswire.discussion_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.tenniswire.discussion_service.client.AuthorProfile;
import com.tenniswire.discussion_service.client.AuthorProfileClient;
import com.tenniswire.discussion_service.entity.BlockMode;
import com.tenniswire.discussion_service.exception.UserServiceUnavailableException;
import com.tenniswire.discussion_service.security.UserIdResolver;
import com.tenniswire.discussion_service.service.BlockService;
import com.tenniswire.discussion_service.service.RestrictionService;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

// The ignore list over HTTP, as the cabinet reads and edits it
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class BlockListTest {

    private static final String BLOCKS = "/api/discussion/blocks";

    @MockitoBean
    private UserIdResolver resolver;

    @MockitoBean
    private AuthorProfileClient profiles;

    @Autowired
    private BlockService blockService;

    @Autowired
    private RestrictionService restrictionService;

    @Autowired
    private DataSource dataSource;

    private final UUID viewer = UUID.randomUUID();
    private final UUID alice = UUID.randomUUID();
    private final UUID bob = UUID.randomUUID();
    // user-service has no profile for her
    private final UUID carol = UUID.randomUUID();

    private MockMvc mvc;

    @BeforeEach
    void bindToChainAndNameEveryone(@Autowired WebApplicationContext context) {
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();
        when(resolver.resolve(any())).thenReturn(viewer);
        var known = Map.of(viewer, "viewer", alice, "alice", bob, "bob");
        when(profiles.profiles(any())).thenAnswer(call -> call.<Collection<UUID>>getArgument(0).stream()
                .filter(known::containsKey)
                .collect(Collectors.toMap(Function.identity(), id -> new AuthorProfile(id, known.get(id), null))));
    }

    @Test
    void theListNamesPeopleLabelsTheRestrictedAndNewestComeFirst() throws Exception {
        blockService.block(viewer, alice, BlockMode.SOFT);
        blockService.block(viewer, bob, BlockMode.GRAVESTONE);
        blockService.block(viewer, carol, BlockMode.SUBTREE_REMOVAL);
        restrictionService.restrictCommenting(bob, UUID.randomUUID(), null, "indefinite");

        mvc.perform(get(BLOCKS).with(reader()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].blockedId").value(carol.toString()))
                .andExpect(jsonPath("$.items[0].user").doesNotExist())
                .andExpect(jsonPath("$.items[0].mode").value("subtree_removal"))
                .andExpect(jsonPath("$.items[1].user.id").value(bob.toString()))
                .andExpect(jsonPath("$.items[1].user.restricted").value(true))
                .andExpect(jsonPath("$.items[1].user.displayName").doesNotExist())
                .andExpect(jsonPath("$.items[2].user.displayName").value("alice"))
                .andExpect(jsonPath("$.items[2].mode").value("soft"))
                .andExpect(jsonPath("$.items[2].createdAt").exists())
                .andExpect(jsonPath("$.nextCursor").doesNotExist());
    }

    @Test
    void aCursorTakesTheReaderThroughTheWholeListOnce() throws Exception {
        for (var i = 0; i < 5; i++) {
            blockService.block(viewer, UUID.randomUUID(), BlockMode.SOFT);
        }

        var seen = new ArrayList<String>();
        var pages = 0;
        String cursor = null;
        do {
            var request = get(BLOCKS).param("limit", "2").with(reader());
            if (cursor != null) {
                request.param("cursor", cursor);
            }
            var body = mvc.perform(request)
                    .andExpect(status().isOk())
                    .andReturn()
                    .getResponse()
                    .getContentAsString();
            List<String> ids = JsonPath.read(body, "$.items[*].blockedId");
            seen.addAll(ids);
            cursor = JsonPath.read(body, "$.nextCursor");
            pages++;
        } while (cursor != null);

        assertThat(pages).isEqualTo(3);
        assertThat(seen).hasSize(5).doesNotHaveDuplicates();
    }

    @Test
    void changingTheModeKeepsThePlaceInTheList() throws Exception {
        blockService.block(viewer, alice, BlockMode.SOFT);
        blockService.block(viewer, bob, BlockMode.SOFT);

        mvc.perform(putMode(alice, "gravestone")).andExpect(status().isOk());

        mvc.perform(get(BLOCKS).with(reader()))
                .andExpect(jsonPath("$.items[0].blockedId").value(bob.toString()))
                .andExpect(jsonPath("$.items[1].blockedId").value(alice.toString()))
                .andExpect(jsonPath("$.items[1].mode").value("gravestone"));
    }

    @Test
    void putAnswersWithTheRowNamedOrLabelled() throws Exception {
        mvc.perform(putMode(alice, "soft"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blockedId").value(alice.toString()))
                .andExpect(jsonPath("$.user.displayName").value("alice"))
                .andExpect(jsonPath("$.mode").value("soft"))
                .andExpect(jsonPath("$.createdAt").exists());

        restrictionService.restrictCommenting(bob, UUID.randomUUID(), null, "indefinite");
        mvc.perform(putMode(bob, "soft"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.restricted").value(true))
                .andExpect(jsonPath("$.user.displayName").doesNotExist());
    }

    @Test
    void oneRowIsReadByThePersonInIt() throws Exception {
        blockService.block(viewer, alice, BlockMode.SUBTREE_REMOVAL);

        mvc.perform(get(BLOCKS + "/" + alice).with(reader()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.displayName").value("alice"))
                .andExpect(jsonPath("$.mode").value("subtree_removal"));
        mvc.perform(get(BLOCKS + "/" + bob).with(reader()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("NOT_FOUND"));
    }

    @Test
    void someoneUserServiceDoesNotKnowIsNotBlockedAndNothingIsStored() throws Exception {
        mvc.perform(putMode(carol, "soft"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("USER_NOT_FOUND"));

        assertThat(blockService.list(viewer)).isEmpty();
    }

    @Test
    void userServiceDownOnPutStoresNothing() throws Exception {
        // doThrow, not when(...): calling the mock inside when() would run the answer stubbed above
        doThrow(new UserServiceUnavailableException("down")).when(profiles).profiles(any());

        mvc.perform(putMode(alice, "soft")).andExpect(status().isServiceUnavailable());

        assertThat(blockService.list(viewer)).isEmpty();
    }

    @Test
    void aFullListRefusesANewPersonButStillChangesAMode() throws Exception {
        blockService.block(viewer, alice, BlockMode.SOFT);
        fill(BlockService.MAX_BLOCKS - 1);

        mvc.perform(putMode(bob, "soft"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("BLOCK_LIST_FULL"))
                .andExpect(jsonPath("$.details.limit").value(BlockService.MAX_BLOCKS));
        mvc.perform(putMode(alice, "gravestone"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mode").value("gravestone"));
    }

    // One statement instead of a request per row
    private void fill(int rows) {
        new JdbcTemplate(dataSource)
                .update(
                        "insert into block (blocker_id, blocked_id, mode) "
                                + "select ?, gen_random_uuid(), 'soft'::block_mode from generate_series(1, ?)",
                        viewer,
                        rows);
    }

    private static MockHttpServletRequestBuilder putMode(UUID blockedId, String mode) {
        return put(BLOCKS + "/" + blockedId)
                .with(reader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"mode\":\"" + mode + "\"}");
    }

    private static RequestPostProcessor reader() {
        return jwt().jwt(j -> j.subject(UUID.randomUUID().toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_user"));
    }
}
