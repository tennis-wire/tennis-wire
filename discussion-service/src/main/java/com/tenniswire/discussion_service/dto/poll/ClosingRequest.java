package com.tenniswire.discussion_service.dto.poll;

import java.time.Instant;
import org.jspecify.annotations.Nullable;

// The whole value each time, so null is a meaning and not an omission: an open poll
public record ClosingRequest(@Nullable Instant closesAt) {}
