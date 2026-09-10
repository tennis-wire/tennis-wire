package com.tenniswire.user_service.repository;

import com.tenniswire.user_service.entity.IdentityLink;
import com.tenniswire.user_service.entity.IdentityLinkId;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface IdentityLinkRepository extends JpaRepository<IdentityLink, IdentityLinkId> {
    List<IdentityLink> findByUserId(UUID userId);

    @Modifying
    @Query(value = """
            insert into identity_link (provider, sub, user_id)
            values (:provider, :sub, :userId)
            on conflict (provider, sub) do nothing
            """, nativeQuery = true)
    int insertIfAbsent(@Param("provider") String provider, @Param("sub") String sub, @Param("userId") UUID userId);
}
