package com.tenniswire.user_service.repository;

import com.tenniswire.user_service.entity.IdentityLink;
import com.tenniswire.user_service.entity.IdentityLinkId;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IdentityLinkRepository extends JpaRepository<IdentityLink, IdentityLinkId> {
    List<IdentityLink> findByUserId(UUID userId);
}
