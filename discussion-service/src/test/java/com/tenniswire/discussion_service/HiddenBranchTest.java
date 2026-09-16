package com.tenniswire.discussion_service;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tenniswire.discussion_service.client.AuthorProfileClient;
import com.tenniswire.discussion_service.entity.BlockMode;
import com.tenniswire.discussion_service.entity.Comment;
import com.tenniswire.discussion_service.security.UserIdResolver;
import com.tenniswire.discussion_service.service.BlockService;
import com.tenniswire.discussion_service.service.CommentService;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

// Ways into a thread below its top level, for a viewer who removes one of its authors with branches
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class HiddenBranchTest {

    private static final String COMMENTS = "/api/discussion/comments";

    @MockitoBean
    private UserIdResolver resolver;

    @MockitoBean
    private AuthorProfileClient profiles;

    @Autowired
    private CommentService commentService;

    @Autowired
    private BlockService blockService;

    private final UUID subjectId = UUID.randomUUID();
    private final UUID viewer = UUID.randomUUID();
    private final UUID alice = UUID.randomUUID();
    private final UUID bob = UUID.randomUUID();
    private final UUID carol = UUID.randomUUID();
    private final UUID dave = UUID.randomUUID();

    // alice, then bob answering her, carol answering bob, dave answering carol
    private Comment byBob;
    private Comment byCarol;
    private Comment byDave;

    private MockMvc mvc;

    @BeforeEach
    void thread(@Autowired WebApplicationContext context) {
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();
        when(resolver.resolve(any())).thenReturn(viewer);
        // nobody is named: every answer here is about whether the comment is there at all
        when(profiles.profiles(any())).thenReturn(Map.of());

        var root =
                commentService.create(alice, "publication", subjectId, "root").comment();
        byBob = commentService.reply(bob, root.id(), "bob").comment();
        byCarol = commentService.reply(carol, byBob.id(), "carol").comment();
        byDave = commentService.reply(dave, byCarol.id(), "dave").comment();
    }

    @ParameterizedTest
    @ValueSource(strings = {"dave/ancestry", "carol/branch", "carol/replies", "bob/branch", "bob/replies"})
    void everyWayIntoARemovedBranchSaysWhoseBlockHidesIt(String way) throws Exception {
        blockService.block(viewer, bob, BlockMode.SUBTREE_REMOVAL);

        mvc.perform(get(url(way)).with(reader()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("HIDDEN_BY_BLOCK"))
                .andExpect(jsonPath("$.details.blockedIds", hasSize(1)))
                .andExpect(jsonPath("$.details.blockedIds[0]").value(bob.toString()));
        // the branch is there for everyone else
        mvc.perform(get(url(way))).andExpect(status().isOk());
    }

    @Test
    void theIdsRunFromTheTopOfTheThread() throws Exception {
        // carol blocked first, so the order of the blocks would give the ids the other way round
        blockService.block(viewer, carol, BlockMode.SUBTREE_REMOVAL);
        blockService.block(viewer, bob, BlockMode.SUBTREE_REMOVAL);

        for (var way : new String[] {"dave/ancestry", "dave/branch"}) {
            mvc.perform(get(url(way)).with(reader()))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.details.blockedIds", hasSize(2)))
                    .andExpect(jsonPath("$.details.blockedIds[0]").value(bob.toString()))
                    .andExpect(jsonPath("$.details.blockedIds[1]").value(carol.toString()));
        }
    }

    @Test
    void aPlaceholderHidesItsBranchWithoutSayingWhoseItWas() throws Exception {
        // carol's reply keeps bob's comment standing as a placeholder
        commentService.deleteOwn(bob, byBob.id());
        blockService.block(viewer, bob, BlockMode.SUBTREE_REMOVAL);

        mvc.perform(get(url("carol/branch")).with(reader()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("HIDDEN_BY_BLOCK"))
                .andExpect(jsonPath("$.details.blockedIds").isEmpty());
    }

    @ParameterizedTest
    @ValueSource(strings = {"dave/ancestry", "dave/branch", "dave/replies"})
    void aCommentNobodyIsShownIsNotFoundInsideARemovedBranchToo(String way) throws Exception {
        // removed with nothing under it: the row stays for moderation, no reader is shown it
        commentService.hideByModerator(byDave.id(), UUID.randomUUID());
        blockService.block(viewer, bob, BlockMode.SUBTREE_REMOVAL);

        mvc.perform(get(url(way)).with(reader()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("NOT_FOUND"));
    }

    @ParameterizedTest
    @EnumSource(
            value = BlockMode.class,
            names = {"SOFT", "GRAVESTONE"})
    void theOtherModesHideNoBranch(BlockMode mode) throws Exception {
        blockService.block(viewer, bob, mode);

        mvc.perform(get(url("dave/ancestry")).with(reader())).andExpect(status().isOk());
        mvc.perform(get(url("carol/branch")).with(reader())).andExpect(status().isOk());
        mvc.perform(get(url("bob/branch")).with(reader())).andExpect(status().isOk());
    }

    // "carol/branch" -> /api/discussion/comments/{carol's comment}/branch
    private String url(String way) {
        var slash = way.indexOf('/');
        var comment =
                switch (way.substring(0, slash)) {
                    case "bob" -> byBob;
                    case "carol" -> byCarol;
                    case "dave" -> byDave;
                    default -> throw new IllegalArgumentException(way);
                };
        return COMMENTS + "/" + comment.id() + way.substring(slash);
    }

    private static RequestPostProcessor reader() {
        return jwt().jwt(j -> j.subject(UUID.randomUUID().toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_user"));
    }
}
