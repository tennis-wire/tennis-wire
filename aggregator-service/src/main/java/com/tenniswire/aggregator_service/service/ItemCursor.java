package com.tenniswire.aggregator_service.service;

import com.tenniswire.aggregator_service.entity.Item;
import com.tenniswire.aggregator_service.exception.InvalidCursorException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Base64;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

// Where a page of the feed ended: the arrival time and id of its last item. Items arriving between
// two pages land above the first and shift nothing below it.
final class ItemCursor {

    private static final String SEPARATOR = "|";

    private ItemCursor() {}

    record Position(Instant createdAt, UUID id) {}

    static String encode(Item last) {
        var raw = last.createdAt() + SEPARATOR + last.id();
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    // Null for the first page
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
