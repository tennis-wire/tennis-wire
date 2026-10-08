package com.tenniswire.discussion_service;

import static org.assertj.core.api.Assertions.assertThat;

import com.tenniswire.discussion_service.exception.DuplicateCommentException;
import com.tenniswire.discussion_service.exception.GlobalExceptionHandler;
import com.tenniswire.discussion_service.exception.LinksNotYetException;
import com.tenniswire.discussion_service.exception.PostingTooFastException;
import com.tenniswire.discussion_service.exception.TooManyLinksException;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;

class PostingErrorResponseTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void tooFastSaysHowLongInWholeSecondsRoundedUp() {
        var response = handler.handlePostingTooFast(new PostingTooFastException(Duration.ofMillis(1500)));

        assertThat(response.getStatusCode().value()).isEqualTo(429);
        assertThat(response.getHeaders().getFirst(HttpHeaders.RETRY_AFTER)).isEqualTo("2");
        assertThat(response.getBody().error()).isEqualTo("TOO_FAST");
        assertThat(response.getBody().details()).containsEntry("retryAfter", 2L);
    }

    @Test
    void tooFastNeverSaysZero() {
        var response = handler.handlePostingTooFast(new PostingTooFastException(Duration.ZERO));

        assertThat(response.getHeaders().getFirst(HttpHeaders.RETRY_AFTER)).isEqualTo("1");
    }

    @Test
    void linksAreRefusedWithTheirOwnCodes() {
        var notYet = handler.handleLinksNotYet(new LinksNotYetException());
        var tooMany = handler.handleTooManyLinks(new TooManyLinksException(3));

        assertThat(notYet.getStatusCode().value()).isEqualTo(422);
        assertThat(notYet.getBody().error()).isEqualTo("LINKS_NOT_YET");
        assertThat(tooMany.getStatusCode().value()).isEqualTo(422);
        assertThat(tooMany.getBody().error()).isEqualTo("TOO_MANY_LINKS");
        assertThat(tooMany.getBody().details()).containsEntry("limit", 3);
    }

    @Test
    void aRepeatIsAConflict() {
        var response = handler.handleDuplicateComment(new DuplicateCommentException());

        assertThat(response.getStatusCode().value()).isEqualTo(409);
        assertThat(response.getBody().error()).isEqualTo("DUPLICATE_COMMENT");
    }
}
