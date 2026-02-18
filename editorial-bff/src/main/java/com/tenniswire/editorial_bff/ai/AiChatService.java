package com.tenniswire.editorial_bff.ai;

import com.anthropic.client.AnthropicClient;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.Model;
import com.tenniswire.editorial_bff.ai.dto.AiChatRequest;
import com.tenniswire.editorial_bff.ai.dto.ChatMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import java.util.function.Consumer;

@Service
public class AiChatService {

    private static final Logger log = LoggerFactory.getLogger(AiChatService.class);

    private static final String SYSTEM_PROMPT =
        """
        Ты — AI-помощник для редактора теннисного новостного сайта Tennis Wire.
        Твоя задача — помогать авторам создавать качественный контент о теннисе.

        Правила:
        - Пиши на том же языке, на котором написан текст пользователя.
        - Сохраняй фактическую точность: имена игроков, счёт матчей, даты турниров.
        - Используй профессиональную теннисную терминологию.
        - Сохраняй HTML-форматирование, если оно присутствует в тексте.
        - Отвечай только обработанным текстом, без пояснений, если не просят иначе.
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
            .system(SYSTEM_PROMPT);

        // If article context is provided, inject it as the first exchange
        if (request.context() != null && !request.context().isBlank()) {
            builder.addUserMessage(
                "Контекст — текст статьи, с которой я работаю:\n\n" + request.context());
            builder.addAssistantMessage(
                "Понял, работаю с этим текстом. Что нужно сделать?");
        }

        // Add conversation history from the frontend
        for (ChatMessage msg : request.messages()) {
            if ("user".equals(msg.role())) {
                builder.addUserMessage(msg.content());
            } else {
                builder.addAssistantMessage(msg.content());
            }
        }

        return builder.build();
    }
}
