package com.tenniswire.discussion_service.dto.reader;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// 'like' or 'dislike' on the vote slot, one of the configured keys on the emoji slot. Checked
// against the set in the service, not here: the set is configuration.
public record ReactionRequest(@NotBlank @Size(max = 32) String value) {}
