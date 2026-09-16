package com.tenniswire.user_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.tenniswire.user_service.client.ReaderTraceClient;
import com.tenniswire.user_service.exception.DiscussionServiceUnavailableException;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

/**
 * What is worth pinning down here is the answer, not the call: it decides whether the account may
 * be deleted now, held until a date, or never, and an answer misread is a ban shed.
 */
class ReaderTraceClientTest {

    private static final String BASE = "http://discussion-service:8093";
    private static final UUID READER = UUID.randomUUID();

    private MockRestServiceServer discussion;
    private ReaderTraceClient traces;

    @BeforeEach
    void bindToAMockedService() {
        var builder = RestClient.builder().baseUrl(BASE);
        discussion = MockRestServiceServer.bindTo(builder).build();
        traces = new ReaderTraceClient(builder.build());
    }

    @Test
    void aReaderUnderNoBanComesBackFreeToDelete() {
        discussion
                .expect(requestTo(BASE + "/internal/users/" + READER))
                .andExpect(method(HttpMethod.DELETE))
                .andRespond(withSuccess("{\"banned\":false,\"bannedUntil\":null}", MediaType.APPLICATION_JSON));

        var erased = traces.erase(READER);

        assertThat(erased.banned()).isFalse();
        assertThat(erased.bannedUntil()).isNull();
    }

    @Test
    void aBanWithADateComesBackWithIt() {
        discussion
                .expect(requestTo(BASE + "/internal/users/" + READER))
                .andRespond(withSuccess(
                        "{\"banned\":true,\"bannedUntil\":\"2026-09-20T12:00:00Z\"}", MediaType.APPLICATION_JSON));

        var erased = traces.erase(READER);

        assertThat(erased.banned()).isTrue();
        assertThat(erased.bannedUntil()).isEqualTo(Instant.parse("2026-09-20T12:00:00Z"));
    }

    @Test
    void aBanWithNoEndComesBackWithNoDate() {
        discussion
                .expect(requestTo(BASE + "/internal/users/" + READER))
                .andRespond(withSuccess("{\"banned\":true,\"bannedUntil\":null}", MediaType.APPLICATION_JSON));

        var erased = traces.erase(READER);

        assertThat(erased.banned()).isTrue();
        assertThat(erased.bannedUntil()).isNull();
    }

    @Test
    void anEmptyAnswerIsNotReadAsNoBan() {
        discussion.expect(requestTo(BASE + "/internal/users/" + READER)).andRespond(withSuccess());

        assertThatThrownBy(() -> traces.erase(READER)).isInstanceOf(DiscussionServiceUnavailableException.class);
    }

    @Test
    void aRefusalIsPassedOnRatherThanSwallowed() {
        discussion.expect(requestTo(BASE + "/internal/users/" + READER)).andRespond(withServerError());

        assertThatThrownBy(() -> traces.erase(READER)).isInstanceOf(DiscussionServiceUnavailableException.class);
    }
}
