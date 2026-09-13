package com.tenniswire.user_service.repository;

import com.tenniswire.user_service.entity.PendingIdentityDelete;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
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
}
