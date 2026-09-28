package com.tenniswire.discussion_service.dto.poll;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import org.jspecify.annotations.Nullable;

public record CreatePollRequest(
        @NotBlank @Size(max = 300) String question,
        @NotNull @Size(min = 2, max = 10) List<@NotBlank @Size(max = 120) String> options,
        @Nullable @Future Instant closesAt,
        // Boxed: an absent component arrives as null, which a primitive refuses outright. Null is one
        // answer per person.
        @Nullable Boolean multipleChoice) {}
