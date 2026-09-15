package com.tenniswire.discussion_service.dto.reader;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateReplyRequest(
        // 2000 by the rules (discussion-rules §4.3); the schema itself holds more
        @NotBlank @Size(max = 2000) String body) {}
