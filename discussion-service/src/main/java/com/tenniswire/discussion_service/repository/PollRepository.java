package com.tenniswire.discussion_service.repository;

import com.tenniswire.discussion_service.entity.Poll;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PollRepository extends JpaRepository<Poll, UUID> {

    // Taken before the counts are read, as for a comment: two votes at once must queue here
    @Query(value = "SELECT id FROM poll WHERE id = :id FOR NO KEY UPDATE", nativeQuery = true)
    Optional<UUID> lockCounters(@Param("id") UUID id);
}
