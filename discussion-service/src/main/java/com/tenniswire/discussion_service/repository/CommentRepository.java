package com.tenniswire.discussion_service.repository;

import com.tenniswire.discussion_service.entity.Comment;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CommentRepository extends JpaRepository<Comment, UUID> {

    /** Top-level comments under a subject, oldest first. No LIMIT yet: see the spec §10, §13. */
    List<Comment> findBySubjectTypeAndSubjectIdAndInReplyToIdIsNullOrderByCreatedAtAscIdAsc(
            String subjectType, UUID subjectId);

    /** The whole thread a comment belongs to, parents before children. */
    List<Comment> findByRootIdOrderByCreatedAtAscIdAsc(UUID rootId);

    /**
     * The subtree rooted at the comment whose ltree path is given, that comment included. ltree
     * operators have no HQL spelling, so this and {@link #findAncestry} are native.
     */
    @Query(
            value = "select * from comment where path <@ cast(:path as ltree) order by created_at, id",
            nativeQuery = true)
    List<Comment> findSubtree(@Param("path") String path);

    /** Root first, the comment itself last: every node whose path is a prefix of the given one. */
    @Query(value = "select * from comment where path @> cast(:path as ltree) order by nlevel(path)", nativeQuery = true)
    List<Comment> findAncestry(@Param("path") String path);

    /** Atomic in the database, so concurrent replies cannot lose an increment. */
    @Modifying
    @Query("update Comment c set c.replyCount = c.replyCount + 1 where c.id = :id")
    int incrementReplyCount(@Param("id") UUID id);
}
