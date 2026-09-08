package com.tenniswire.editorial_bff.ai.dto;

import com.anthropic.models.messages.Model;

public enum AiModel {
    HAIKU("claude-haiku-4-5"),
    SONNET("claude-sonnet-5"),
    OPUS("claude-opus-5");

    private final String id;

    AiModel(String id) {
        this.id = id;
    }

    public Model toSdk() {
        return Model.of(id);
    }
}
