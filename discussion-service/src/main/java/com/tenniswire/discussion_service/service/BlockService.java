package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.entity.Block;
import com.tenniswire.discussion_service.entity.BlockId;
import com.tenniswire.discussion_service.entity.BlockMode;
import com.tenniswire.discussion_service.repository.BlockRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class BlockService {

    private final BlockRepository blocks;

    public BlockService(BlockRepository blocks) {
        this.blocks = blocks;
    }

    /** Creates the block or changes the mode of an existing one. */
    public Block block(UUID blockerId, UUID blockedId, BlockMode mode) {
        if (blockerId.equals(blockedId)) {
            throw new IllegalArgumentException("Cannot block yourself");
        }
        var id = new BlockId(blockerId, blockedId);
        var block = blocks.findById(id).orElseGet(() -> new Block(id, mode));
        block.mode(mode);
        return blocks.save(block);
    }

    /** Idempotent: unblocking someone who was not blocked is not an error. */
    public void unblock(UUID blockerId, UUID blockedId) {
        blocks.deleteById(new BlockId(blockerId, blockedId));
    }

    @Transactional(readOnly = true)
    public List<Block> list(UUID blockerId) {
        return blocks.findByIdBlockerIdOrderByCreatedAtAsc(blockerId);
    }
}
