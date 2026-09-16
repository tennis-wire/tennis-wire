package com.tenniswire.discussion_service.repository;

import com.tenniswire.discussion_service.entity.Block;
import com.tenniswire.discussion_service.entity.BlockId;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BlockRepository extends JpaRepository<Block, BlockId> {

    List<Block> findByIdBlockerIdOrderByCreatedAtAsc(UUID blockerId);

    long countByIdBlockerId(UUID blockerId);

    // Keyset, newest first. A mode change leaves created_at alone, so a row keeps its place in the
    // list however often it is edited. No index of its own: the primary key finds one reader's
    // rows, and there are at most a thousand of them to sort.
    @Query(value = """
select * from block
where blocker_id = :blockerId
order by created_at desc, blocked_id desc
limit :limit
""", nativeQuery = true)
    List<Block> findNewestFirst(@Param("blockerId") UUID blockerId, @Param("limit") int limit);

    @Query(value = """
select * from block
where blocker_id = :blockerId and (created_at, blocked_id) < (:beforeCreatedAt, :beforeId)
order by created_at desc, blocked_id desc
limit :limit
""", nativeQuery = true)
    List<Block> findNewestFirstBefore(
            @Param("blockerId") UUID blockerId,
            @Param("beforeCreatedAt") Instant beforeCreatedAt,
            @Param("beforeId") UUID beforeId,
            @Param("limit") int limit);

    // Both directions: whom he ignored is his, and who ignored him is a row about him. Neither
    // means anything once he is gone, and the second would go on hiding a comment with no author
    // from whoever wrote it (discussion-rules §13.15).
    @Modifying
    @Query("delete from Block b where b.id.blockerId = :readerId or b.id.blockedId = :readerId")
    int deleteInvolving(@Param("readerId") UUID readerId);
}
