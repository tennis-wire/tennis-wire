package com.tenniswire.discussion_service.dto.poll;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

// Wording only. Options are edited in place by id, never added or dropped: a vote already cast
// counts for a choice, and the choice must stay the one it was.
public record UpdatePollRequest(
        @Nullable @NotBlank @Size(max = 300) String question,
        @Nullable List<@NotNull OptionText> options) {

    public record OptionText(
            @NotNull UUID id, @NotBlank @Size(max = 120) String text) {}
}
