package com.tenniswire.discussion_service.dto.reader;

import java.time.Instant;
import org.jspecify.annotations.Nullable;

// What the reader who asked may do in the thread, sent next to what he is shown of it. restriction is
// null when nothing stops him from writing; until is null for a restriction with no end.
public record ViewerResponse(@Nullable Restriction restriction) {

    public record Restriction(@Nullable Instant until) {}
}
