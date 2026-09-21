package com.tenniswire.content_service.media;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;

// Containers built by hand, with no picture inside: the inspector walks the structure and never
// decodes a pixel, so the structure is all a fixture needs.
public final class TestImages {

    public static final String SECRET = "SecretPhone";

    private TestImages() {}

    public static byte[] png(int width, int height) {
        var out = new ByteArrayOutputStream();
        out.writeBytes(new byte[] {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'});
        out.writeBytes(pngChunk(
                "IHDR", ByteBuffer.allocate(13).putInt(width).putInt(height).array()));
        out.writeBytes(pngChunk("tEXt", ascii("Comment\0" + SECRET)));
        out.writeBytes(pngChunk("IDAT", new byte[] {1, 2, 3}));
        out.writeBytes(pngChunk("IEND", new byte[0]));
        return out.toByteArray();
    }

    // Exif in the byte order asked for, a comment, a scan with a stuffed 0xFF and a restart marker
    // in it, and something appended after the end of the image
    public static byte[] jpeg(int width, int height, int orientation, ByteOrder order) {
        var tiff = ByteBuffer.allocate(26 + SECRET.length()).order(order);
        tiff.put(ascii(order == ByteOrder.LITTLE_ENDIAN ? "II" : "MM"));
        tiff.putShort((short) 42).putInt(8).putShort((short) 1);
        tiff.putShort((short) 0x0112).putShort((short) 3).putInt(1);
        tiff.putShort((short) orientation).putShort((short) 0);
        tiff.putInt(0).put(ascii(SECRET));

        var frame =
                ByteBuffer.allocate(6).put((byte) 8).putShort((short) height).putShort((short) width);

        var out = new ByteArrayOutputStream();
        out.writeBytes(new byte[] {(byte) 0xFF, (byte) 0xD8});
        out.writeBytes(jpegSegment(0xE0, ascii("JFIF\0")));
        out.writeBytes(jpegSegment(0xE1, concat(ascii("Exif\0\0"), tiff.array())));
        out.writeBytes(jpegSegment(0xFE, ascii(SECRET)));
        out.writeBytes(jpegSegment(0xC0, frame.array()));
        out.writeBytes(jpegSegment(0xDA, new byte[] {1, 2}));
        out.writeBytes(new byte[] {0x11, (byte) 0xFF, 0x00, 0x22, (byte) 0xFF, (byte) 0xD0, 0x33});
        out.writeBytes(new byte[] {(byte) 0xFF, (byte) 0xD9});
        out.writeBytes(ascii(SECRET));
        return out.toByteArray();
    }

    // Extended layout with both metadata chunks; the XMP one has an odd length, so it is padded
    public static byte[] webp(int width, int height) {
        var header = ByteBuffer.allocate(10).order(ByteOrder.LITTLE_ENDIAN);
        header.put((byte) 0x0C).put(new byte[3]);
        header.put(u24le(width - 1)).put(u24le(height - 1));

        var body = new ByteArrayOutputStream();
        body.writeBytes(ascii("WEBP"));
        body.writeBytes(riffChunk("VP8X", header.array()));
        body.writeBytes(riffChunk("VP8 ", new byte[] {1, 2, 3, 4}));
        body.writeBytes(riffChunk("EXIF", ascii(SECRET + "!")));
        body.writeBytes(riffChunk("XMP ", ascii(SECRET)));
        return riffChunk("RIFF", body.toByteArray());
    }

    public static boolean contains(byte[] haystack, String needle) {
        return contains(haystack, ascii(needle));
    }

    public static boolean contains(byte[] haystack, byte[] needle) {
        var text = new String(haystack, StandardCharsets.ISO_8859_1);
        return text.contains(new String(needle, StandardCharsets.ISO_8859_1));
    }

    private static byte[] pngChunk(String type, byte[] data) {
        // the checksum is left zero: nothing here verifies it
        return ByteBuffer.allocate(12 + data.length)
                .putInt(data.length)
                .put(ascii(type))
                .put(data)
                .array();
    }

    private static byte[] jpegSegment(int marker, byte[] payload) {
        return ByteBuffer.allocate(4 + payload.length)
                .put((byte) 0xFF)
                .put((byte) marker)
                .putShort((short) (payload.length + 2))
                .put(payload)
                .array();
    }

    private static byte[] riffChunk(String type, byte[] data) {
        return ByteBuffer.allocate(8 + data.length + (data.length & 1))
                .order(ByteOrder.LITTLE_ENDIAN)
                .put(ascii(type))
                .putInt(data.length)
                .put(data)
                .array();
    }

    private static byte[] u24le(int value) {
        return new byte[] {(byte) value, (byte) (value >> 8), (byte) (value >> 16)};
    }

    private static byte[] concat(byte[] first, byte[] second) {
        return ByteBuffer.allocate(first.length + second.length)
                .put(first)
                .put(second)
                .array();
    }

    private static byte[] ascii(String text) {
        return text.getBytes(StandardCharsets.US_ASCII);
    }
}
