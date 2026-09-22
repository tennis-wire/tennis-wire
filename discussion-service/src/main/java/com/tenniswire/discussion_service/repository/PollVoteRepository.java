package com.tenniswire.discussion_service.repository;

import com.tenniswire.discussion_service.entity.PollVote;
import com.tenniswire.discussion_service.entity.PollVoteId;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PollVoteRepository extends JpaRepository<PollVote, PollVoteId> {

    // Ordered by poll so that two erasures running at once lock polls in the same order
    @Query("select v from PollVote v where v.userId = :userId order by v.pollId")
    List<PollVote> findByUser(@Param("userId") UUID userId);
}
