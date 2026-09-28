package com.tenniswire.discussion_service.repository;

import java.util.UUID;

public record RemovalTally(UUID authorId, Long total, Long recent) {}
