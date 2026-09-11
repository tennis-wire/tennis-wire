package com.tenniswire.discussion_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasKey;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tenniswire.discussion_service.client.AuthorProfile;
import com.tenniswire.discussion_service.client.AuthorProfileClient;
import com.tenniswire.discussion_service.entity.BlockMode;
import com.tenniswire.discussion_service.exception.UserServiceUnavailableException;
import com.tenniswire.discussion_service.repository.CommentRepository;
import com.tenniswire.discussion_service.security.UserIdResolver;
import com.tenniswire.discussion_service.service.BlockService;
import com.tenniswire.discussion_service.service.CommentService;
import com.tenniswire.discussion_service.service.RestrictionService;
import java.util.Collection;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class CommentAuthorTest {

    private static final String COMMENTS = "/api/discussion/comments";

    @MockitoBean
    private UserIdResolver resolver;

    @MockitoBean
    private AuthorProfileClient profiles;

    @Autowired
    private CommentService commentService;

    @Autowired
    private BlockService blockService;

    @Autowired
    private RestrictionService restrictionService;

    @Autowired
    private CommentRepository commentRepository;

    private final UUID subjectId = UUID.randomUUID();
    private final UUID alice = UUID.randomUUID();
    private final UUID bob = UUID.randomUUID();
    private final UUID viewer = UUID.randomUUID();

    private MockMvc mvc;

    @BeforeEach
    void bindToChainAndNameEveryone(@Autowired WebApplicationContext context) {
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();
        var known = Map.of(alice, "alice", bob, "bob");
        when(profiles.profiles(any())).thenAnswer(call -> call.<Collection<UUID>>getArgument(0).stream()
                .filter(known::containsKey)
                .collect(Collectors.toMap(Function.identity(), id -> new AuthorProfile(id, known.get(id), null))));
    }

    @Test
    void aVisibleCommentNamesItsAuthor() throws Exception {
        commentService.create(alice, "article", subjectId, "hello");

        mvc.perform(listing())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].author.id").value(alice.toString()))
                .andExpect(jsonPath("$.items[0].author.displayName").value("alice"))
                .andExpect(jsonPath("$.items[0].author", hasKey("avatarUrl")))
                .andExpect(jsonPath("$.items[0].author.restricted").doesNotExist())
                .andExpect(jsonPath("$.items[0].authorId").doesNotExist());
    }

    @Test
    void aRestrictedAuthorIsFlaggedAndNeitherNamedNorLookedUp() throws Exception {
        commentService.create(alice, "article", subjectId, "hello");
        restrictionService.restrictCommenting(alice, UUID.randomUUID(), null, "indefinite");

        mvc.perform(listing())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].author.id").value(alice.toString()))
                .andExpect(jsonPath("$.items[0].author.restricted").value(true))
                .andExpect(jsonPath("$.items[0].author.displayName").doesNotExist())
                .andExpect(jsonPath("$.items[0].author.avatarUrl").doesNotExist());

        verifyNoInteractions(profiles);
    }

    @Test
    void hidingAnAuthorWithholdsTheNameAndCollapsingKeepsIt() throws Exception {
        commentService.create(alice, "article", subjectId, "hidden");
        commentService.create(bob, "article", subjectId, "collapsed");
        blockService.block(viewer, alice, BlockMode.GRAVESTONE);
        blockService.block(viewer, bob, BlockMode.SOFT);
        when(resolver.resolve(any())).thenReturn(viewer);

        mvc.perform(listing().with(reader()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].visibility").value("gravestone"))
                .andExpect(jsonPath("$.items[0].author").doesNotExist())
                .andExpect(jsonPath("$.items[1].visibility").value("soft_hidden"))
                .andExpect(jsonPath("$.items[1].author.displayName").value("bob"));
    }

    @Test
    void aDeletedCommentHasNoAuthor() throws Exception {
        var comment = commentService.create(alice, "article", subjectId, "gone").comment();
        commentService.deleteOwn(alice, comment.id());

        mvc.perform(listing())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].visibility").value("deleted"))
                .andExpect(jsonPath("$.items[0].author").doesNotExist());
    }

    @Test
    void anAuthorUserServiceDoesNotKnowIsLeftOut() throws Exception {
        commentService.create(UUID.randomUUID(), "article", subjectId, "orphan");

        mvc.perform(listing())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].body").value("orphan"))
                .andExpect(jsonPath("$.items[0].author").doesNotExist());
    }

    @Test
    void aBranchNamesEveryReplyWithOneLookup() throws Exception {
        var root = commentService.create(alice, "article", subjectId, "root").comment();
        commentService.reply(bob, root.id(), "reply");

        mvc.perform(get(COMMENTS + "/" + root.id() + "/branch"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.root.author.displayName").value("alice"))
                .andExpect(jsonPath("$.root.replies[0].author.displayName").value("bob"));

        verify(profiles, times(1)).profiles(any());
    }

    @Test
    void userServiceDownFailsTheWholeListing() throws Exception {
        commentService.create(alice, "article", subjectId, "hello");
        // doThrow, not when(...): calling the mock inside when() would run the answer stubbed above
        doThrow(new UserServiceUnavailableException("down")).when(profiles).profiles(any());

        mvc.perform(listing())
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("SERVICE_UNAVAILABLE"));
    }

    @Test
    void userServiceDownOnPostStoresNothing() throws Exception {
        when(resolver.resolve(any())).thenReturn(alice);
        doThrow(new UserServiceUnavailableException("down")).when(profiles).profiles(any());

        mvc.perform(post(COMMENTS)
                        .with(reader())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(commentBody("retry me")))
                .andExpect(status().isServiceUnavailable());

        assertThat(commentRepository.findBySubjectTypeAndSubjectIdAndInReplyToIdIsNullOrderByCreatedAtAscIdAsc(
                        "article", subjectId))
                .isEmpty();
    }

    private MockHttpServletRequestBuilder listing() {
        return get(COMMENTS).param("subjectType", "article").param("subjectId", subjectId.toString());
    }

    private String commentBody(String text) {
        return "{\"subjectType\":\"article\",\"subjectId\":\"" + subjectId + "\",\"body\":\"" + text + "\"}";
    }

    private static RequestPostProcessor reader() {
        return jwt().jwt(j -> j.subject(UUID.randomUUID().toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_user"));
    }
}
