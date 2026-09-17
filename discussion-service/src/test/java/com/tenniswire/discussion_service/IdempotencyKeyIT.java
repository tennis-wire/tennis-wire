package com.tenniswire.discussion_service;

import static com.tenniswire.discussion_service.TwoWriters.PATIENCE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.tenniswire.discussion_service.client.AuthorProfileClient;
import com.tenniswire.discussion_service.entity.BlockMode;
import com.tenniswire.discussion_service.event.DomainEventPublisher;
import com.tenniswire.discussion_service.repository.CommentRepository;
import com.tenniswire.discussion_service.security.UserIdResolver;
import com.tenniswire.discussion_service.service.BlockService;
import com.tenniswire.discussion_service.service.CommentService;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedQueue;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class IdempotencyKeyIT {

    private static final String COMMENTS = "/api/discussion/comments";
    private static final String IDEMPOTENCY_KEY = "Idempotency-Key";

    @MockitoBean
    private UserIdResolver resolver;

    @MockitoBean
    private AuthorProfileClient profiles;

    // Called after the insert and before the commit: where a first send is held still for a second
    @MockitoSpyBean
    private DomainEventPublisher events;

    @Autowired
    private CommentService commentService;

    @Autowired
    private BlockService blockService;

    @Autowired
    private CommentRepository rows;

    @Autowired
    private DataSource dataSource;

    private final UUID subjectId = UUID.randomUUID();
    private final UUID alice = UUID.randomUUID();
    private final UUID bob = UUID.randomUUID();
    private final UUID key = UUID.randomUUID();

    private MockMvc mvc;
    private TwoWriters writers;

    @BeforeEach
    void bindToChainAndStopTheFirstWriterBeforeItCommits(@Autowired WebApplicationContext context) {
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();
        when(resolver.resolve(any())).thenReturn(alice);
        // nobody has a name here, and nothing below needs one
        when(profiles.profiles(any())).thenReturn(Map.of());
        writers = new TwoWriters(dataSource);
        doAnswer(call -> {
                    call.callRealMethod();
                    writers.stopTheFirst();
                    return null;
                })
                .when(events)
                .publish(any());
    }

    @Test
    void aCommentSentAgainUnderItsKeyIsTheSameComment() throws Exception {
        var first =
                mvc.perform(topLevel("once")).andExpect(status().isCreated()).andReturn();
        var id = JsonPath.<String>read(first.getResponse().getContentAsString(), "$.comment.id");

        mvc.perform(topLevel("once"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.comment.id").value(id));

        assertThat(rows.findTopLevelFirstPage("publication", subjectId, 10)).hasSize(1);
    }

    @Test
    void aReplySentAgainIsCountedOnceAndStillToldItIsMuted() throws Exception {
        var root = commentService.create(bob, "publication", subjectId, "root").comment();
        blockService.block(bob, alice, BlockMode.SOFT);

        var first = mvc.perform(reply(root.id(), "once"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.mutedByRecipient").value(true))
                .andReturn();
        var id = JsonPath.<String>read(first.getResponse().getContentAsString(), "$.comment.id");

        mvc.perform(reply(root.id(), "once"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.comment.id").value(id))
                .andExpect(jsonPath("$.mutedByRecipient").value(true));

        assertThat(rows.findById(root.id()).orElseThrow().replyCount()).isOne();
    }

    @Test
    void aKeySentWithAnotherTextIsRefused() throws Exception {
        mvc.perform(topLevel("once")).andExpect(status().isCreated());

        mvc.perform(topLevel("twice"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.error").value("IDEMPOTENCY_KEY_REUSED"));

        assertThat(rows.findTopLevelFirstPage("publication", subjectId, 10)).hasSize(1);
    }

    @Test
    void aKeyIsOnlyItsOwnAuthors() throws Exception {
        mvc.perform(topLevel("alice's")).andExpect(status().isCreated());
        when(resolver.resolve(any())).thenReturn(bob);

        mvc.perform(topLevel("bob's")).andExpect(status().isCreated());

        assertThat(rows.findTopLevelFirstPage("publication", subjectId, 10)).hasSize(2);
    }

    // The client gave up waiting and sent again while the first send was still being written. The
    // second waits for the first to commit instead of meeting the unique index halfway.
    @Test
    void aSendRepeatedWhileTheFirstIsBeingWrittenWaitsForIt() throws Exception {
        var ids = new ConcurrentLinkedQueue<UUID>();

        var late = writers.race(() -> ids.add(send()), () -> ids.add(send()));

        assertThat(late).succeedsWithin(PATIENCE);
        assertThat(ids).hasSize(2);
        assertThat(Set.copyOf(ids)).hasSize(1);
        assertThat(rows.findTopLevelFirstPage("publication", subjectId, 10)).hasSize(1);
    }

    private UUID send() {
        return commentService
                .create(alice, "publication", subjectId, "once", key)
                .comment()
                .id();
    }

    private MockHttpServletRequestBuilder topLevel(String text) {
        return post(COMMENTS)
                .with(reader())
                .header(IDEMPOTENCY_KEY, key.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"subjectType\":\"publication\",\"subjectId\":\"%s\",\"body\":\"%s\"}"
                        .formatted(subjectId, text));
    }

    private MockHttpServletRequestBuilder reply(UUID parentId, String text) {
        return post(COMMENTS + "/" + parentId + "/replies")
                .with(reader())
                .header(IDEMPOTENCY_KEY, key.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"body\":\"" + text + "\"}");
    }

    private static RequestPostProcessor reader() {
        return jwt().jwt(j -> j.subject(UUID.randomUUID().toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_user"));
    }
}
