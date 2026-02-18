package com.tenniswire.editorial_bff.ai;

import com.tenniswire.editorial_bff.ai.dto.AiChatRequest;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@RestController
@RequestMapping("/api/ai")
public class AiChatController {

    private static final Logger log = LoggerFactory.getLogger(AiChatController.class);
    private static final long SSE_TIMEOUT_MS = 120_000L; // 2 minutes

    private final AiChatService aiChatService;

    /**
     * Virtual thread executor — each streaming request gets its own lightweight
     * thread. The thread spends most of its time waiting for chunks from Claude,
     * so virtual threads are ideal (barely consume OS resources).
     */
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    public AiChatController(AiChatService aiChatService) {
        this.aiChatService = aiChatService;
    }

    /**
     * Streams AI chat response as Server-Sent Events.
     *
     * <p>Flow:
     * <ol>
     *   <li>Creates an SseEmitter and returns it (HTTP connection stays open)
     *   <li>In a virtual thread, calls Claude API via the SDK
     *   <li>Each text chunk → pushed to emitter → sent to the browser
     *   <li>When done, sends [DONE] and closes the connection
     * </ol>
     */
    @PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chat(@Valid @RequestBody AiChatRequest request) {
        var emitter = new SseEmitter(SSE_TIMEOUT_MS);

        executor.execute(() -> {
            try {
                aiChatService.streamChat(request, text -> {
                    try {
                        emitter.send(SseEmitter.event().data(text));
                    } catch (IOException e) {
                        throw new UncheckedIOException(e);
                    }
                });

                emitter.send(SseEmitter.event().data("[DONE]"));
                emitter.complete();
            } catch (UncheckedIOException e) {
                log.debug("Client disconnected");
                emitter.completeWithError(e);
            } catch (Exception e) {
                log.error("AI chat streaming failed", e);
                emitter.completeWithError(e);
            }
        });

        return emitter;
    }
}
