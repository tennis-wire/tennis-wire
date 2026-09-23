package com.tenniswire.discussion_service.repository;

import com.tenniswire.discussion_service.entity.UserRestriction;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

public interface UserRestrictionRepository extends JpaRepository<UserRestriction, UUID> {

    /** Active restrictions for a capability: not lifted, and indefinite or expiring after {@code now}. */
    @Query("""
            select r from UserRestriction r
            where r.userId = :userId and r.capability = :capability
              and r.liftedAt is null and (r.expiresAt is null or r.expiresAt > :now)
            order by r.expiresAt desc nulls first
            """)
    List<UserRestriction> findActive(
            @Param("userId") UUID userId, @Param("capability") String capability, @Param("now") Instant now);

    // The active restrictions of a whole page of users, ordered so that the first row for each is
    // the binding one. Unlike findRestrictedAmong this keeps the expiry: the moderation queue shows
    // the ban itself, not merely that there is one
    @Query("""
        select r from UserRestriction r
        where r.userId in :userIds and r.capability = :capability
          and r.liftedAt is null and (r.expiresAt is null or r.expiresAt > :now)
        order by r.expiresAt desc nulls first
        """)
    List<UserRestriction> findActiveAmong(
            @Param("userIds") Collection<UUID> userIds,
            @Param("capability") String capability,
            @Param("now") Instant now);

    /** Which of the given users have an active restriction for a capability: one query for a whole page. */
    @Query("""
            select distinct r.userId from UserRestriction r
            where r.userId in :userIds and r.capability = :capability
              and r.liftedAt is null and (r.expiresAt is null or r.expiresAt > :now)
            """)
    Set<UUID> findRestrictedAmong(
            @Param("userIds") Collection<UUID> userIds,
            @Param("capability") String capability,
            @Param("now") Instant now);

    // One ban decision per reader at a time: two moderators replacing the same ban would otherwise
    // both find it standing and leave two. The two-argument key space is shared with the comment
    // locks; 3 is this lock's name within it. Held until the transaction ends.
    @Transactional(propagation = Propagation.MANDATORY)
    @Query(value = "select 1 from pg_advisory_xact_lock(3, :key)", nativeQuery = true)
    int lockReader(@Param("key") int key);

    // Expired and lifted rows only: his ban history goes with the account. A ban still running
    // outlives it on purpose: it is the answer the erase gives user-service, and asking twice has to
    // give it twice. Once it has run out, the next erase for the same reader sweeps it up.
    @Modifying
    @Query("""
        delete from UserRestriction r
        where r.userId = :readerId
          and (r.liftedAt is not null or (r.expiresAt is not null and r.expiresAt <= :now))
        """)
    int deleteEndedFor(@Param("readerId") UUID readerId, @Param("now") Instant now);
}
