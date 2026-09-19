package com.tenniswire.discussion_service.repository;

import com.tenniswire.discussion_service.entity.AuthorReactionTotal;
import java.util.Collection;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuthorReactionTotalRepository extends JpaRepository<AuthorReactionTotal, UUID> {

    @Modifying
    @Query("delete from AuthorReactionTotal t where t.authorId in :authorIds")
    int deleteFor(@Param("authorIds") Collection<UUID> authorIds);
}
