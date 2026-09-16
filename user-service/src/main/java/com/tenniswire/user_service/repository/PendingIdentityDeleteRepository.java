package com.tenniswire.user_service.repository;

import com.tenniswire.user_service.entity.PendingIdentityDelete;
import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface PendingIdentityDeleteRepository extends JpaRepository<PendingIdentityDelete, UUID> {

    // Guarded on being unset so that a second request does not restart the clock the erase waits on.
    // The timestamp comes from the database, which is the one clock every part of this agrees on.
    @Transactional
    @Modifying
    @Query("""
        update PendingIdentityDelete p
        set p.identityClosedAt = current_timestamp
        where p.userId = :userId and p.identityClosedAt is null
        """)
    int markIdentityClosed(@Param("userId") UUID userId);

    // Due first, and only what is due. The reasons an account waits are still worked out in one
    // place (the step itself), but the answer is kept on the row, because a row that is waiting has
    // to be invisible here rather than read and put back. Some are never finished at all: a ban with
    // no end holds its address for good, and enough of those would otherwise fill this page and
    // leave nothing new ever reached.
    // The filter is written over the same expression the index is on, so one range scan serves both
    // it and the order. "Not looked at yet" needs no case of its own: a row was requested in the
    // past, so coalescing to requested_at is already due. current_timestamp rather than a parameter
    // because requested_at is written by that clock too, and the margin here is zero: a few seconds
    // of drift between the database and the JVM would make a new row look as if it were not due.
    @Query("""
        select p.userId from PendingIdentityDelete p
        where coalesce(p.retryAfter, p.requestedAt) <= current_timestamp
        order by coalesce(p.retryAfter, p.requestedAt)
        """)
    List<UUID> due(Pageable page);

    // Skipped rather than waited for: another instance is already working this account, and there
    // are others to get on with. -2 is Hibernate's SKIP LOCKED.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "-2"))
    @Query("select p from PendingIdentityDelete p where p.userId = :userId")
    Optional<PendingIdentityDelete> claim(@Param("userId") UUID userId);
}
