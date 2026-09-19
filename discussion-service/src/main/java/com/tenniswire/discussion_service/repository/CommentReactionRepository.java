package com.tenniswire.discussion_service.repository;

import com.tenniswire.discussion_service.entity.CommentReaction;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CommentReactionRepository extends JpaRepository<CommentReaction, UUID> {

    Optional<CommentReaction> findByCommentIdAndUserIdAndSlot(UUID commentId, UUID userId, String slot);

    List<CommentReaction> findByCommentIdIn(Collection<UUID> commentIds);

    List<CommentReaction> findByUserIdAndCommentIdIn(UUID userId, Collection<UUID> commentIds);

    // Everything one person put anywhere, so his account going or a permanent ban can take the
    // counts down with the rows. Ordered by comment so the caller locks trees in a stable order.
    @Query("select r from CommentReaction r where r.userId = :userId order by r.commentId, r.id")
    List<CommentReaction> findByUser(@Param("userId") UUID userId);

    @Modifying
    @Query("delete from CommentReaction r where r.commentId = :commentId")
    int deleteOn(@Param("commentId") UUID commentId);

    @Modifying
    @Query("delete from CommentReaction r where r.commentId in :commentIds")
    int deleteOnAll(@Param("commentIds") Collection<UUID> commentIds);
}
