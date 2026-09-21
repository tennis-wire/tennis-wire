package com.tenniswire.discussion_service.entity;

import java.io.Serializable;
import java.util.UUID;

public record PollVoteId(UUID pollId, UUID userId) implements Serializable {}
