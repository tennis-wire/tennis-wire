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

    // Whoever asked first is dealt with first. The table holds one row per account on its way out
    // and empties itself, so it is read whole rather than through a query that would have to encode
    // every reason a row might not be due yet — those live in one place, in the step itself.
    @Query("select p.userId from PendingIdentityDelete p order by p.requestedAt")
    List<UUID> oldestFirst(Pageable page);

    // Skipped rather than waited for: another instance is already working this account, and there
    // are others to get on with. -2 is Hibernate's SKIP LOCKED.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "-2"))
    @Query("select p from PendingIdentityDelete p where p.userId = :userId")
    Optional<PendingIdentityDelete> claim(@Param("userId") UUID userId);
}
