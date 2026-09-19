package com.tenniswire.discussion_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.tenniswire.discussion_service.exception.UnknownSubjectTypeException;
import com.tenniswire.discussion_service.service.CommentService;
import com.tenniswire.discussion_service.service.CommentSort;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/** The allowlist as the service sees it, against the same application.yaml the service runs with. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class SubjectTypeGateIT {

    @Autowired
    private CommentService commentService;

    private final UUID subjectId = UUID.randomUUID();
    private final UUID alice = UUID.randomUUID();

    @Test
    void anUnknownSubjectIsRefusedOnTheWayIn() {
        assertThatThrownBy(() -> commentService.create(alice, "match", subjectId, "hello"))
                .isInstanceOf(UnknownSubjectTypeException.class);
    }

    @Test
    void anUnknownSubjectIsRefusedOnTheListingRatherThanAnsweredWithNothing() {
        assertThatThrownBy(() -> commentService.listTopLevel("artcle", subjectId, null, null, null, CommentSort.OLDEST))
                .isInstanceOf(UnknownSubjectTypeException.class);
    }

    @Test
    void aReplyIsNotCheckedAgainAndTakesTheSubjectOfItsParent() {
        var root =
                commentService.create(alice, "publication", subjectId, "root").comment();
        var reply = commentService.reply(alice, root.id(), "reply").comment();

        assertThat(reply.subjectType()).isEqualTo("publication");
        assertThatCode(() ->
                        commentService.listTopLevel("publication", subjectId, null, null, null, CommentSort.OLDEST))
                .doesNotThrowAnyException();
    }
}
