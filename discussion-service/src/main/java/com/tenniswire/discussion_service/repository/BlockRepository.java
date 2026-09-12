package com.tenniswire.discussion_service.repository;

import com.tenniswire.discussion_service.entity.Block;
import com.tenniswire.discussion_service.entity.BlockId;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BlockRepository extends JpaRepository<Block, BlockId> {

    List<Block> findByIdBlockerIdOrderByCreatedAtAsc(UUID blockerId);

    // Both directions: whom he ignored is his, and who ignored him is a row about him. Neither
    // means anything once he is gone, and the second would go on hiding a comment with no author
    // from whoever wrote it (discussion-rules §13.15).
    @Modifying
    @Query("delete from Block b where b.id.blockerId = :readerId or b.id.blockedId = :readerId")
    int deleteInvolving(@Param("readerId") UUID readerId);
}
