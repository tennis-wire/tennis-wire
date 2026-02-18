package com.tenniswire.editorial_bff.ai.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/**
 * Request from the editorial frontend.
 *
 * @param messages conversation history (at least one user message)
 * @param context  optional article text from the editor for Claude to work with
 */
public record AiChatRequest(
    @NotEmpty @Valid List<ChatMessage> messages,
    String context) {}
