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

    // Removals and hand-counted violations land in one total. A counted one has no source of its
    // own — only a person counts one — hence the coalesce. The two columns exclude each other.
    @Query("""
        select new com.tenniswire.discussion_service.repository.RemovalTally(
            c.authorId,
            coalesce(c.hiddenSource, 'moderator'),
            count(c),
            sum(case when coalesce(c.hiddenAt, c.countedAt) > :since then 1 else 0 end))
        from Comment c
        where c.authorId in :authorIds and (c.hiddenAt is not null or c.countedAt is not null)
        group by c.authorId, coalesce(c.hiddenSource, 'moderator')
        """)
    List<RemovalTally> countRemovalsAmong(
            @Param("authorIds") Collection<UUID> authorIds, @Param("since") Instant since);

    // current_timestamp, not the JVM clock: compared against updated_at, which a trigger writes.
    @Modifying
    @Query("update Comment c set c.reportsClosedAt = current_timestamp where c.id = :id")
    int markReportsClosed(@Param("id") UUID id);

    @Modifying
    @Query("""
        update Comment c
        set c.reportsClosedAt = current_timestamp, c.countedAt = current_timestamp
        where c.id = :id
        """)
    int markCounted(@Param("id") UUID id);
}
