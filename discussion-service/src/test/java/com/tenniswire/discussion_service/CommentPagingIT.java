package com.tenniswire.discussion_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.tenniswire.discussion_service.entity.BlockMode;
import com.tenniswire.discussion_service.exception.InvalidCursorException;
import com.tenniswire.discussion_service.service.BlockService;
import com.tenniswire.discussion_service.service.CommentService;
import java.util.ArrayList;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class CommentPagingIT {

    private static final int PAGE = 10;

    @Autowired
    private CommentService commentService;

    @Autowired
    private BlockService blockService;

    private final UUID subjectId = UUID.randomUUID();
    private final UUID alice = UUID.randomUUID();
    private final UUID loud = UUID.randomUUID();

    @Test
    void pagesWalkTheWholeThreadWithoutRepeatingOrLosingAComment() {
        for (var i = 0; i < 25; i++) {
            commentService.create(alice, "publication", subjectId, "c" + i);
        }

        var seen = new ArrayList<UUID>();
        String cursor = null;
        var pages = 0;
        do {
            var page = commentService.listTopLevel("publication", subjectId, null, PAGE, cursor);
            page.items().forEach(view -> seen.add(view.comment().id()));
            cursor = page.nextCursor();
            pages++;
        } while (cursor != null && pages < 10);

        assertThat(pages).isEqualTo(3);
        assertThat(seen).hasSize(25).doesNotHaveDuplicates();
    }

    @Test
    void aPageTheViewerHasRemovedInFullIsEmptyButStillCarriesACursor() {
        for (var i = 0; i < 12; i++) {
            commentService.create(loud, "publication", subjectId, "loud " + i);
        }
        commentService.create(alice, "publication", subjectId, "quiet");
        blockService.block(alice, loud, BlockMode.SUBTREE_REMOVAL);

        var first = commentService.listTopLevel("publication", subjectId, alice, PAGE, null);
        assertThat(first.items()).isEmpty();
        // the whole point: an empty page is not the end, and the reader must be able to page past it
        assertThat(first.nextCursor()).isNotNull();

        var second = commentService.listTopLevel("publication", subjectId, alice, PAGE, first.nextCursor());
        assertThat(second.items()).hasSize(1);
        assertThat(second.nextCursor()).isNull();
    }

    @Test
    void theLastPageCarriesNoCursorEvenWhenItIsExactlyFull() {
        for (var i = 0; i < PAGE; i++) {
            commentService.create(alice, "publication", subjectId, "c" + i);
        }

        var only = commentService.listTopLevel("publication", subjectId, null, PAGE, null);

        assertThat(only.items()).hasSize(PAGE);
        assertThat(only.nextCursor()).isNull();
    }

    @Test
    void aLimitOutsideTheRangeIsBroughtIntoItRatherThanRefused() {
        commentService.create(alice, "publication", subjectId, "one");
        commentService.create(alice, "publication", subjectId, "two");

        assertThat(commentService
                        .listTopLevel("publication", subjectId, null, 0, null)
                        .items())
                .hasSize(1);
    }

    @Test
    void aCursorWeDidNotIssueIsRefused() {
        assertThatThrownBy(() -> commentService.listTopLevel("publication", subjectId, null, PAGE, "not-a-cursor"))
                .isInstanceOf(InvalidCursorException.class);
    }
}
