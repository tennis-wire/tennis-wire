package com.tenniswire.discussion_service.dto.reader;

import com.tenniswire.discussion_service.entity.Block;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record BlockResponse(UUID blockedId, String mode, Instant createdAt) {

    public static BlockResponse from(Block block) {
        return new BlockResponse(block.id().blockedId(), block.mode().value(), block.createdAt());
    }

    public static List<BlockResponse> from(List<Block> blocks) {
        return blocks.stream().map(BlockResponse::from).toList();
    }
}
