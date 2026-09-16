package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.entity.Block;
import com.tenniswire.discussion_service.entity.BlockId;
import com.tenniswire.discussion_service.entity.BlockMode;
import com.tenniswire.discussion_service.exception.BlockListFullException;
import com.tenniswire.discussion_service.exception.ResourceNotFoundException;
import com.tenniswire.discussion_service.repository.BlockRepository;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class BlockService {

    public static final int MAX_BLOCKS = 1000;

    // Same as the comment listings
    private static final int DEFAULT_LIMIT = 50;
    private static final int MAX_LIMIT = 200;
    private static final int MIN_LIMIT = 1;

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
        var existing = blocks.findById(id);
        if (existing.isPresent()) {
            // A full list refuses a new person only: a mode can always be changed
            return blocks.save(existing.get().mode(mode));
        }
        // Counted, not locked: two requests at once can both find room and pass the ceiling by a
        // row. Harmless, the list is the reader's own.
        if (blocks.countByIdBlockerId(blockerId) >= MAX_BLOCKS) {
            throw new BlockListFullException(MAX_BLOCKS);
        }
        // flush now: created_at comes back from the INSERT, and the response carries it
        return blocks.saveAndFlush(new Block(id, mode));
    }

    /** Idempotent: unblocking someone who was not blocked is not an error. */
    public void unblock(UUID blockerId, UUID blockedId) {
        blocks.deleteById(new BlockId(blockerId, blockedId));
    }

    @Transactional(readOnly = true)
    public List<Block> list(UUID blockerId) {
        return blocks.findByIdBlockerIdOrderByCreatedAtAsc(blockerId);
    }

    // Newest first; a limit out of range is clamped, as on the comment listings. Keyset rather than
    // offset: someone ignored meanwhile lands above the cursor, so the next page neither repeats a
    // row nor skips one.
    @Transactional(readOnly = true)
    public BlockPage page(UUID blockerId, @Nullable Integer limit, @Nullable String cursor) {
        var size = limit == null ? DEFAULT_LIMIT : Math.clamp(limit, MIN_LIMIT, MAX_LIMIT);
        var before = CommentCursor.decode(cursor);

        var rows = before == null
                ? blocks.findNewestFirst(blockerId, size + 1)
                : blocks.findNewestFirstBefore(blockerId, before.createdAt(), before.id(), size + 1);
        var more = rows.size() > size;
        var page = more ? rows.subList(0, size) : rows;

        var nextCursor = more
                ? CommentCursor.encode(
                        page.getLast().createdAt(), page.getLast().id().blockedId())
                : null;
        return new BlockPage(page, nextCursor);
    }

    // One row, for a reader who ran into his own block somewhere other than the list
    @Transactional(readOnly = true)
    public Block one(UUID blockerId, UUID blockedId) {
        return blocks.findById(new BlockId(blockerId, blockedId))
                .orElseThrow(() -> new ResourceNotFoundException("Block", blockedId));
    }
}
