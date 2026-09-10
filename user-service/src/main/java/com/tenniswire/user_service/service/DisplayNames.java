package com.tenniswire.user_service.service;

import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.regex.Pattern;

public final class DisplayNames {

    /** Letters, digits, underscore, hyphen. Also the regex behind the request DTO annotation. */
    public static final String PATTERN = "^[A-Za-z0-9_-]{3,24}$";

    static final String STUB_PREFIX = "reader-";

    private static final Pattern COMPILED = Pattern.compile(PATTERN);
    private static final int STUB_RANDOM_BYTES = 4; // 8 hex characters
    private static final SecureRandom RANDOM = new SecureRandom();

    private DisplayNames() {}

    public static String generateStub() {
        var bytes = new byte[STUB_RANDOM_BYTES];
        RANDOM.nextBytes(bytes);
        return STUB_PREFIX + HexFormat.of().formatHex(bytes);
    }

    public static boolean isValid(String displayName) {
        return displayName != null && COMPILED.matcher(displayName).matches();
    }
}
