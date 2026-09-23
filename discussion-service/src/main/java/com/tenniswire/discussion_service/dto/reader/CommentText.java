package com.tenniswire.discussion_service.dto.reader;

import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;

// Characters that draw nothing and are there to move or hide what is drawn: direction overrides,
// isolates and marks, zero-width spaces, the word joiner, the byte order mark. U+202E alone makes
// "txt.exe" read "exe.txt". ZWJ and ZWNJ stay: emoji sequences are built with them.
public final class CommentText {

    private static final Pattern INVISIBLE = Pattern.compile(
            "[\\x{061C}\\x{200B}\\x{200E}\\x{200F}\\x{202A}-\\x{202E}\\x{2060}-\\x{2064}\\x{2066}-\\x{2069}\\x{FEFF}]");

    private CommentText() {}

    public static @Nullable String clean(@Nullable String body) {
        return body == null ? null : INVISIBLE.matcher(body).replaceAll("");
    }
}
