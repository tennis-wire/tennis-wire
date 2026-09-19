package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.entity.Comment;
import com.tenniswire.discussion_service.exception.InvalidCursorException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Base64;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * Where the last page of the top-level listing ended. Carries the sort it was cut for: the position
 * means different things under different orders, and a cursor handed to another sort would either
 * skip comments or repeat them rather than fail.
 */
final class TopLevelCursor {

    private static final String SEPARATOR = "|";
    private static final int PARTS = 4;

    private TopLevelCursor() {}

    record Position(CommentSort sort, Instant createdAt, UUID id, int score) {}

    static String encode(CommentSort sort, Comment last) {
        var raw = String.join(
                SEPARATOR,
                sort.value(),
                last.createdAt().toString(),
                last.id().toString(),
                Integer.toString(last.likeCount() - last.dislikeCount()));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    // Null for the first page: no cursor and an empty one both mean "start at the beginning"
    static @Nullable Position decode(@Nullable String cursor, CommentSort sort) {
        if (cursor == null || cursor.isBlank()) {
            return null;
        }
        String raw;
        try {
            raw = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            throw new InvalidCursorException(e);
        }
        var parts = raw.split("\\" + SEPARATOR, -1);
        if (parts.length != PARTS) {
            throw new InvalidCursorException(null);
        }
        Position position;
        try {
            position = new Position(
                    CommentSort.fromValue(parts[0]),
                    Instant.parse(parts[1]),
                    UUID.fromString(parts[2]),
                    Integer.parseInt(parts[3]));
        } catch (DateTimeParseException | IllegalArgumentException e) {
            throw new InvalidCursorException(e);
        }
        if (position.sort() != sort) {
            throw new InvalidCursorException(null);
        }
        return position;
    }
}
