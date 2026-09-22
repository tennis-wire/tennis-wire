package com.tenniswire.discussion_service.dto.poll;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record VoteRequest(@NotNull UUID optionId) {}
