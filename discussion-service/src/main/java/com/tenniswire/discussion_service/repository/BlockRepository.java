package com.tenniswire.discussion_service.repository;

import com.tenniswire.discussion_service.entity.Block;
import com.tenniswire.discussion_service.entity.BlockId;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BlockRepository extends JpaRepository<Block, BlockId> {

    List<Block> findByIdBlockerIdOrderByCreatedAtAsc(UUID blockerId);
}
