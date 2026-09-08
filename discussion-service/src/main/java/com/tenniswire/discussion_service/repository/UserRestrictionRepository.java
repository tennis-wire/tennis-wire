package com.tenniswire.discussion_service.repository;

import com.tenniswire.discussion_service.entity.UserRestriction;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRestrictionRepository extends JpaRepository<UserRestriction, UUID> {

    /** Active restrictions for a capability: indefinite ones, or those expiring after {@code now}. */
    @Query("""
            select r from UserRestriction r
            where r.userId = :userId and r.capability = :capability
              and (r.expiresAt is null or r.expiresAt > :now)
            order by r.expiresAt desc nulls first
            """)
    List<UserRestriction> findActive(
            @Param("userId") UUID userId, @Param("capability") String capability, @Param("now") Instant now);
}
