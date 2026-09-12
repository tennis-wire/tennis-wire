package com.tenniswire.discussion_service.repository;

import com.tenniswire.discussion_service.entity.Comment;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CommentRepository extends JpaRepository<Comment, UUID> {

    List<Comment> findBySubjectTypeAndSubjectIdAndInReplyToIdIsNullOrderByCreatedAtAscIdAsc(
            String subjectType, UUID subjectId);

    List<Comment> findByRootIdOrderByCreatedAtAscIdAsc(UUID rootId);

    @Query(
            value = "select * from comment where path <@ cast(:path as ltree) order by created_at, id",
            nativeQuery = true)
    List<Comment> findSubtree(@Param("path") String path);

    @Query(value = "select * from comment where path @> cast(:path as ltree) order by nlevel(path)", nativeQuery = true)
    List<Comment> findAncestry(@Param("path") String path);

    @Modifying
    @Query("update Comment c set c.replyCount = c.replyCount + 1 where c.id = :id")
    int incrementReplyCount(@Param("id") UUID id);

    // How many comments moderation has taken down from each of these authors, all time and since a date
    @Query("""
        select new com.tenniswire.discussion_service.repository.RemovalTally(
            c.authorId, c.hiddenSource, count(c),
            sum(case when c.hiddenAt > :since then 1 else 0 end))
        from Comment c
        where c.authorId in :authorIds and c.hiddenAt is not null
        group by c.authorId, c.hiddenSource
        """)
    List<RemovalTally> countRemovalsAmong(
            @Param("authorIds") Collection<UUID> authorIds, @Param("since") Instant since);

    @Modifying
    @Query("update Comment c set c.reportsClosedAt = current_timestamp where c.id = :id")
    int markReportsClosed(@Param("id") UUID id);
}
