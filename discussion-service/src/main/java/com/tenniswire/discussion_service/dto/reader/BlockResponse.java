package com.tenniswire.discussion_service.dto.reader;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.tenniswire.discussion_service.entity.Block;
import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

// A row of the reader's own ignore list. user takes the forms a comment's author does and is
// missing where user-service has no profile; blockedId is always there, so the row can be lifted.
public record BlockResponse(
        UUID blockedId,
        @JsonInclude(JsonInclude.Include.NON_NULL) @Nullable AuthorResponse user,
        String mode,
        Instant createdAt) {

    public static BlockResponse from(Block block, @Nullable AuthorResponse user) {
        return new BlockResponse(block.id().blockedId(), user, block.mode().value(), block.createdAt());
    }
}
