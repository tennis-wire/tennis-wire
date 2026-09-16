package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.entity.Comment;
import com.tenniswire.discussion_service.exception.InvalidCursorException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Base64;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

final class CommentCursor {

    private static final String SEPARATOR = "|";

    private CommentCursor() {}

    record Position(Instant createdAt, UUID id) {}

    static String encode(Comment last) {
        return encode(last.createdAt(), last.id());
    }

    // The ignore list pages by the same pair, a time and an id, so it takes its cursor from here too
    static String encode(Instant createdAt, UUID id) {
        var raw = createdAt + SEPARATOR + id;
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    // Null for the first page: no cursor and an empty one both mean "start at the beginning"
    static @Nullable Position decode(@Nullable String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return null;
        }
        String raw;
        try {
            raw = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            throw new InvalidCursorException(e);
        }
        var at = raw.indexOf(SEPARATOR);
        if (at < 0) {
            throw new InvalidCursorException(null);
        }
        try {
            return new Position(Instant.parse(raw.substring(0, at)), UUID.fromString(raw.substring(at + 1)));
        } catch (DateTimeParseException | IllegalArgumentException e) {
            throw new InvalidCursorException(e);
        }
    }
}
