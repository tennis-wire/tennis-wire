package com.tenniswire.content_service.repository;

import com.tenniswire.content_service.entity.Tag;
import com.tenniswire.content_service.entity.TagType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TagRepository extends JpaRepository<Tag, UUID>, JpaSpecificationExecutor<Tag> {

    Optional<Tag> findBySlug(String slug);

    Set<Tag> findByIdIn(Collection<UUID> ids);

    boolean existsBySlug(String slug);

    List<Tag> findByType(TagType type);

    // -- Active sections ordered by sort_order --

    List<Tag> findByTypeAndIsActiveTrueOrderBySortOrder(TagType type);

    // -- Cross-entity check: tag used by articles (cannot express as Specification) --

    @Query("SELECT COUNT(a) > 0 FROM Article a JOIN a.tags t WHERE t.id = :tagId")
    boolean isTagUsedByArticles(@Param("tagId") UUID tagId);
}
