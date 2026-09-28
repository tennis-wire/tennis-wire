package com.tenniswire.discussion_service.dto.poll;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

// The whole of this person's choice, replacing whatever it was: one option in a single-choice poll,
// one or more in a multiple-choice one. Taking it all back is the DELETE.
public record VoteRequest(@NotEmpty @Size(max = 10) List<@NotNull UUID> optionIds) {}
