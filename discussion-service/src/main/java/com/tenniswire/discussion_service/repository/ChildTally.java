package com.tenniswire.discussion_service.repository;

import java.util.UUID;

public record ChildTally(UUID parentId, Long children) {}
