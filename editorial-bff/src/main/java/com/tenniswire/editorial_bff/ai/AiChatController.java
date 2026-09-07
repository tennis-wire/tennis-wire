package com.tenniswire.editorial_bff.ai;

import com.tenniswire.editorial_bff.ai.dto.AiChatRequest;
import jakarta.annotation.PreDestroy;
import jakarta.validation.Valid;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import tools.jackson.databind.json.JsonMapper;

@RestController
@RequestMapping("/api/ai")
public class AiChatController {

    private static final Logger log = LoggerFactory.getLogger(AiChatController.class);

    /**
     * Kept below the gateway's response-timeout of 120 s on purpose: we want to
     * close first and get a terminating frame out, rather than have the gateway
     * cut the connection and leave the browser with a truncated answer and no
     * explanation.
     */
    private static final long SSE_TIMEOUT_MS = 110_000L;

    private final AiChatService aiChatService;

    /**
     * Jackson 3, which is what Boot 4 auto-configures. Jackson 2 is also on the
     * classpath — the Anthropic SDK brings it — so asking for the wrong one
     * compiles cleanly and only fails when the context starts.
     */
    private final JsonMapper json;

    /**
     * Virtual thread executor — each streaming request gets its own lightweight
     * thread. The thread spends most of its time waiting for chunks from Claude,
     * so virtual threads are ideal (barely consume OS resources).
     */
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    public AiChatController(AiChatService aiChatService, JsonMapper json) {
        this.aiChatService = aiChatService;
        this.json = json;
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }

    /**
     * Streams AI chat response as Server-Sent Events.
     *
     * <p>Flow:
     * <ol>
     *   <li>Creates an SseEmitter and returns it (HTTP connection stays open)
     *   <li>In a virtual thread, calls Claude API via the SDK
     *   <li>Each text chunk → a {@code delta} frame → sent to the browser
     *   <li>When done, sends a {@code done} frame and closes the connection
     * </ol>
     */
    @PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chat(@Valid @RequestBody AiChatRequest request) {
        var emitter = new SseEmitter(SSE_TIMEOUT_MS);

        executor.execute(() -> {
            try {
                aiChatService.streamChat(request, text -> send(emitter, "delta", text));
                send(emitter, "done", "");
                emitter.complete();
            } catch (UncheckedIOException e) {
                log.debug("Client disconnected");
                emitter.completeWithError(e);
            } catch (Exception e) {
                // The response is committed the moment the first delta goes out,
                // so AiErrorHandler can no longer write a status or a body. A
                // frame inside the stream is the only channel left to say what
                // happened; without it the answer just stops mid-sentence.
                log.error("AI chat streaming failed", e);
                trySendError(emitter);
                emitter.complete();
            }
        });

        return emitter;
    }

    /**
     * Sends one named frame carrying a JSON-encoded payload.
     *
     * <p>The payload is JSON rather than the raw delta because Spring rewrites a
     * value containing a newline into several {@code data:} lines, which the
     * client then has to rejoin. Ours did not, so every line break in an answer
     * was silently dropped and the reply arrived as one block of text. A JSON
     * string is single-line by construction. It also removes the chance of a
     * model writing the literal sentinel and ending its own stream.
     *
     * <p>Written as {@code text/plain} because it is already serialised — that
     * pins the converter choice to StringHttpMessageConverter and rules out
     * Jackson encoding it a second time.
     */
    private void send(SseEmitter emitter, String event, Object payload) {
        try {
            emitter.send(SseEmitter.event().name(event).data(json.writeValueAsString(payload), MediaType.TEXT_PLAIN));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private void trySendError(SseEmitter emitter) {
        try {
            send(emitter, "error", Map.of("message", "AI-сервис временно недоступен. Попробуйте позже."));
        } catch (UncheckedIOException e) {
            log.debug("Could not deliver the error frame; the client is already gone");
        }
    }
}
