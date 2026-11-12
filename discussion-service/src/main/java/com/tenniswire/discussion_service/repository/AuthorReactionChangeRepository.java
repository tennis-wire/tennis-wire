package com.tenniswire.discussion_service.repository;

import com.tenniswire.discussion_service.entity.AuthorReactionChange;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

public interface AuthorReactionChangeRepository extends JpaRepository<AuthorReactionChange, Long> {

    @Query("select c from AuthorReactionChange c order by c.id")
    List<AuthorReactionChange> findOldest(Pageable page);

    @Modifying
    @Query("delete from AuthorReactionChange c where c.authorId = :authorId")
    int deleteFor(@Param("authorId") UUID authorId);

    // One fold at a time across instances, in the two-argument key space of CommentRepository's
    // locks; 5 is this lock's name. Tried rather than waited for: an instance that finds it taken
    // leaves the work to the one holding it. Held until the transaction ends.
    @Transactional(propagation = Propagation.MANDATORY)
    @Query(value = "select pg_try_advisory_xact_lock(5, 0)", nativeQuery = true)
    boolean tryLockFold();

    // The same lock, waited for: an erasure has to come after a fold in progress, not skip it
    @Transactional(propagation = Propagation.MANDATORY)
    @Query(value = "select 1 from pg_advisory_xact_lock(5, 0)", nativeQuery = true)
    int lockFold();
}
