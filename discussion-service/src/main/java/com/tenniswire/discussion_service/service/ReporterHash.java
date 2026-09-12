package com.tenniswire.discussion_service.service;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public class ReporterHash {

    private static final String ALGORITHM = "HmacSHA256";

    private static final int UUID_PAIR_BYTES = 32;

    private final SecretKeySpec key;

    public ReporterHash(String key) {
        this.key = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), ALGORITHM);
    }

    public byte[] of(UUID reporterId, UUID commentId) {
        // A Mac instance is not thread-safe and is cheaper to build than to guard.
        Mac mac;
        try {
            mac = Mac.getInstance(ALGORITHM);
            mac.init(key);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException("HmacSHA256 unavailable, or the report hash key is unusable", e);
        }
        return mac.doFinal(bytesOf(reporterId, commentId));
    }

    // Fixed width in a fixed order, so the pair cannot be read two ways.
    private static byte[] bytesOf(UUID reporterId, UUID commentId) {
        return ByteBuffer.allocate(UUID_PAIR_BYTES)
                .putLong(reporterId.getMostSignificantBits())
                .putLong(reporterId.getLeastSignificantBits())
                .putLong(commentId.getMostSignificantBits())
                .putLong(commentId.getLeastSignificantBits())
                .array();
    }
}
