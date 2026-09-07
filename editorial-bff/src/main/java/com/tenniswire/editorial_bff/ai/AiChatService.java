package com.tenniswire.editorial_bff.ai;

import com.anthropic.client.AnthropicClient;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.Model;
import com.tenniswire.editorial_bff.ai.dto.AiChatRequest;
import com.tenniswire.editorial_bff.ai.dto.ChatMessage;
import java.util.function.Consumer;
import org.springframework.stereotype.Service;

@Service
public class AiChatService {

    private static final String SYSTEM_PROMPT =
        """
        Ты — AI-помощник редакции Tennis Wire, теннисного новостного сайта.
        Ты работаешь рядом с редактором, прямо в окне редактирования статьи.

        Чаще всего тебя просят о работе с текстом: написать материал с нуля,
        вычитать черновик, предложить заголовок, лид или структуру. Но ты
        обычный собеседник: если спрашивают о другом — отвечай по существу,
        а не переводи разговор обратно на теннис.

        Как отвечать:
        - Пиши на языке собеседника.
        - Отвечай в Markdown: **жирный**, списки, заголовки. Разметку
          разбирает редактор, поэтому HTML-теги руками писать не нужно.
        - Береги факты: имена игроков, счёт, даты и названия турниров.
          Не уверен — так и скажи, вместо того чтобы угадывать.
        - Пиши так, как принято в спортивной журналистике, и свободно
          пользуйся теннисной терминологией.
        - Просят отредактировать или переписать — отдавай готовый текст без
          вступлений вроде «вот исправленный вариант». Короткая ремарка
          уместна, если ты поменял смысл или заметил фактическую ошибку.
        - На вопрос отвечай развёрнуто, на просьбу — делом.
        """;

    private static final String CONTEXT_PREAMBLE =
        """

        ---

        Ниже — материал, открытый сейчас в редакторе. Это справочный
        контекст, а не задание: собеседник может спрашивать о нём, а может
        и о чём-то постороннем. Отталкивайся от того, о чём тебя спросили.

        """;

    private final AnthropicClient client;

    public AiChatService(AnthropicClient client) {
        this.client = client;
    }

    /**
     * Streams AI response, calling {@code textConsumer} for each text chunk.
     *
     * <p>This method blocks until the full response is received. The caller
     * (controller) runs it in a virtual thread to avoid blocking servlet threads.
     *
     * @param request      the chat request from the frontend
     * @param textConsumer callback invoked for each text chunk
     */
    public void streamChat(AiChatRequest request, Consumer<String> textConsumer) {
        var params = buildParams(request);

        try (var streamResponse = client.messages().createStreaming(params)) {
            streamResponse.stream()
                .flatMap(event -> event.contentBlockDelta().stream())
                .flatMap(deltaEvent -> deltaEvent.delta().text().stream())
                .forEach(textDelta -> textConsumer.accept(textDelta.text()));
        }
    }

    private MessageCreateParams buildParams(AiChatRequest request) {
        var builder = MessageCreateParams.builder()
            .model(Model.CLAUDE_SONNET_4_5)
            .maxTokens(4096L)
            .system(buildSystem(request));

        for (ChatMessage msg : request.messages()) {
            if ("user".equals(msg.role())) {
                builder.addUserMessage(msg.content());
            } else {
                builder.addAssistantMessage(msg.content());
            }
        }

        return builder.build();
    }

    /**
     * Puts the article into the system block rather than a fabricated exchange.
     *
     * <p>The previous version opened every conversation with an invented pair of
     * turns — the article as a user message, and an assistant reply saying it was
     * ready to work on that text. Nobody said that second line, and it framed
     * every following question as a task about the article, which is why a plain
     * greeting came back as a menu of editing services.
     *
     * <p>Standing instructions belong in the system block anyway. It also opens
     * the door to prompt caching later, so a long article stops being re-billed
     * as input on every turn.
     */
    private String buildSystem(AiChatRequest request) {
        var context = request.context();
        if (context == null || context.isBlank()) {
            return SYSTEM_PROMPT;
        }
        return SYSTEM_PROMPT + CONTEXT_PREAMBLE + context;
    }
}
