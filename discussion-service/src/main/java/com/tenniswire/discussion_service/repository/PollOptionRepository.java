package com.tenniswire.discussion_service.repository;

import com.tenniswire.discussion_service.entity.PollOption;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PollOptionRepository extends JpaRepository<PollOption, UUID> {}
