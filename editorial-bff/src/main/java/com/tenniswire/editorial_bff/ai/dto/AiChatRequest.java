package com.tenniswire.editorial_bff.ai.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/**
 * Request from the editorial frontend.
 *
 * @param messages    conversation history (at least one user message)
 * @param context     optional article text from the editor for Claude to work with
 * @param isSelection whether {@code context} is a fragment the user highlighted
 *                    rather than the whole document — a highlighted fragment is
 *                    almost always what the question is about, the full text is
 *                    usually just background
 */
public record AiChatRequest(
        @NotEmpty @Valid List<ChatMessage> messages, String context, boolean isSelection, AiModel model) {

    public AiChatRequest {
        if (model == null) {
            model = AiModel.SONNET;
        }
    }
}
