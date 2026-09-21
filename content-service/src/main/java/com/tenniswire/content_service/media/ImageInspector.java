package com.tenniswire.content_service.media;

import com.tenniswire.content_service.exception.UnsupportedImageException;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;

// Names the format from the bytes, never from what the client called the file, and removes the
// metadata a camera writes: location, device, thumbnails. Pixels are not re-encoded, the containers
// are only walked and copied.
public final class ImageInspector {

    private static final byte[] JPEG_MAGIC = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] PNG_MAGIC = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'};

    private static final int JPEG_EOI = 0xD9;
    private static final int JPEG_SOS = 0xDA;
    private static final int JPEG_APP0 = 0xE0;
    private static final int JPEG_APP1 = 0xE1;
    private static final int JPEG_APP2 = 0xE2;
    private static final int JPEG_APP14 = 0xEE;
    private static final int JPEG_APP15 = 0xEF;
    private static final int JPEG_COM = 0xFE;

    private static final int EXIF_ORIENTATION_TAG = 0x0112;

    private static final Set<String> PNG_METADATA_CHUNKS = Set.of("eXIf", "tEXt", "zTXt", "iTXt", "tIME");

    private static final int WEBP_EXIF_AND_XMP_FLAGS = 0x0C;

    private ImageInspector() {}

    public static InspectedImage inspect(byte[] raw) {
        try {
            if (startsWith(raw, 0, JPEG_MAGIC)) {
                return jpeg(raw);
            }
            if (startsWith(raw, 0, PNG_MAGIC)) {
                return png(raw);
            }
            if (hasAscii(raw, 0, "RIFF") && hasAscii(raw, 8, "WEBP")) {
                return webp(raw);
            }
            if (hasAscii(raw, 0, "GIF87a") || hasAscii(raw, 0, "GIF89a")) {
                return checked("image/gif", "gif", u16le(raw, 6), u16le(raw, 8), raw);
            }
        } catch (IndexOutOfBoundsException e) {
            throw new UnsupportedImageException("The image file is truncated or corrupt", e);
        }
        throw new UnsupportedImageException("Only JPEG, PNG, WebP and GIF images are accepted");
    }

    // -- JPEG --

    private static InspectedImage jpeg(byte[] raw) {
        var out = new ByteArrayOutputStream(raw.length);
        out.write(raw, 0, 2);

        int width = 0;
        int height = 0;
        int orientation = 0;
        int pos = 2;
        while (pos + 1 < raw.length) {
            if (u8(raw, pos) != 0xFF) {
                throw new UnsupportedImageException("The image file is truncated or corrupt");
            }
            int marker = u8(raw, pos + 1);
            if (marker == 0xFF) {
                pos++;
                continue;
            }
            if (marker == JPEG_EOI) {
                // Whatever follows is not this picture: a second frame, a gain map, the video of
                // a motion photo. None of it is drawn by a browser and all of it carries metadata.
                out.write(raw, pos, 2);
                break;
            }
            if (isStandalone(marker)) {
                out.write(raw, pos, 2);
                pos += 2;
                continue;
            }

            int length = u16be(raw, pos + 2);
            int end = pos + 2 + length;
            if (length < 2 || end > raw.length) {
                throw new IndexOutOfBoundsException(end);
            }
            if (marker == JPEG_SOS) {
                int scanEnd = endOfScan(raw, end);
                out.write(raw, pos, scanEnd - pos);
                pos = scanEnd;
                continue;
            }
            if (isStartOfFrame(marker)) {
                height = u16be(raw, pos + 5);
                width = u16be(raw, pos + 7);
            }
            if (marker == JPEG_APP1 && orientation == 0 && hasAscii(raw, pos + 4, "Exif\0\0")) {
                // The one tag that changes how the picture looks: without it a phone's portrait
                // shot lies on its side. Written back alone, in place of the block it came from.
                orientation = exifOrientation(raw, pos + 10, end);
                if (orientation > 1) {
                    out.writeBytes(orientationSegment(orientation));
                }
            } else if (keepsJpegSegment(raw, pos, marker)) {
                out.write(raw, pos, end - pos);
            }
            pos = end;
        }

        boolean turned = orientation >= 5;
        return checked("image/jpeg", "jpg", turned ? height : width, turned ? width : height, out.toByteArray());
    }

    private static boolean isStandalone(int marker) {
        return marker == 0x01 || marker >= 0xD0 && marker <= 0xD7;
    }

    private static boolean isStartOfFrame(int marker) {
        return marker >= 0xC0 && marker <= 0xCF && marker != 0xC4 && marker != 0xC8 && marker != 0xCC;
    }

    // Inside a scan 0xFF is always followed by 0x00 or a restart marker; anything else ends it
    private static int endOfScan(byte[] raw, int from) {
        int pos = from;
        while (pos + 1 < raw.length) {
            if (u8(raw, pos) == 0xFF) {
                int next = u8(raw, pos + 1);
                if (next != 0x00 && next != 0xFF && !isStandalone(next)) {
                    return pos;
                }
            }
            pos++;
        }
        return raw.length;
    }

    // APP0 is JFIF, APP14 tells a decoder how CMYK and YCCK are stored, and APP2 is kept only when
    // it is the colour profile: its other tenant, MPF, points at the frames dropped after EOI.
    private static boolean keepsJpegSegment(byte[] raw, int pos, int marker) {
        if (marker == JPEG_COM) {
            return false;
        }
        if (marker < JPEG_APP0 || marker > JPEG_APP15) {
            return true;
        }
        return marker == JPEG_APP0
                || marker == JPEG_APP14
                || marker == JPEG_APP2 && hasAscii(raw, pos + 4, "ICC_PROFILE\0");
    }

    private static int exifOrientation(byte[] raw, int tiff, int end) {
        boolean littleEndian;
        if (hasAscii(raw, tiff, "II")) {
            littleEndian = true;
        } else if (hasAscii(raw, tiff, "MM")) {
            littleEndian = false;
        } else {
            return 1;
        }
        long ifdOffset = littleEndian ? u32le(raw, tiff + 4) : u32be(raw, tiff + 4);
        if (ifdOffset > end - tiff - 2) {
            return 1;
        }
        int ifd = tiff + (int) ifdOffset;
        int entries = littleEndian ? u16le(raw, ifd) : u16be(raw, ifd);
        for (int i = 0; i < entries; i++) {
            int entry = ifd + 2 + 12 * i;
            if (entry + 12 > end) {
                break;
            }
            int tag = littleEndian ? u16le(raw, entry) : u16be(raw, entry);
            if (tag == EXIF_ORIENTATION_TAG) {
                int value = littleEndian ? u16le(raw, entry + 8) : u16be(raw, entry + 8);
                return value >= 1 && value <= 8 ? value : 1;
            }
        }
        return 1;
    }

    // An Exif block with a single IFD entry: orientation, SHORT, count 1
    private static byte[] orientationSegment(int orientation) {
        return new byte[] {
            (byte) 0xFF,
            (byte) JPEG_APP1,
            0,
            34,
            'E',
            'x',
            'i',
            'f',
            0,
            0,
            'M',
            'M',
            0,
            42,
            0,
            0,
            0,
            8,
            0,
            1,
            0x01,
            0x12,
            0,
            3,
            0,
            0,
            0,
            1,
            0,
            (byte) orientation,
            0,
            0,
            0,
            0,
            0,
            0,
        };
    }

    // -- PNG --

    private static InspectedImage png(byte[] raw) {
        var out = new ByteArrayOutputStream(raw.length);
        out.write(raw, 0, PNG_MAGIC.length);

        int width = 0;
        int height = 0;
        int pos = PNG_MAGIC.length;
        while (pos + 12 <= raw.length) {
            long length = u32be(raw, pos);
            if (length > raw.length - pos - 12) {
                throw new IndexOutOfBoundsException(pos);
            }
            int total = 12 + (int) length;
            var type = new String(raw, pos + 4, 4, StandardCharsets.US_ASCII);
            if ("IHDR".equals(type)) {
                width = (int) Math.min(u32be(raw, pos + 8), Integer.MAX_VALUE);
                height = (int) Math.min(u32be(raw, pos + 12), Integer.MAX_VALUE);
            }
            if (!PNG_METADATA_CHUNKS.contains(type)) {
                out.write(raw, pos, total);
            }
            pos += total;
            if ("IEND".equals(type)) {
                break;
            }
        }
        return checked("image/png", "png", width, height, out.toByteArray());
    }

    // -- WebP --

    private static InspectedImage webp(byte[] raw) {
        var out = new ByteArrayOutputStream(raw.length);
        out.write(raw, 0, 12);

        int width = 0;
        int height = 0;
        int flagsAt = -1;
        int pos = 12;
        while (pos + 8 <= raw.length) {
            long size = u32le(raw, pos + 4);
            if (size > raw.length - pos - 8) {
                throw new IndexOutOfBoundsException(pos);
            }
            int payload = pos + 8;
            // chunks are padded to an even length; the last one is sometimes left unpadded
            int end = (int) Math.min(payload + size + (size & 1), raw.length);
            var type = new String(raw, pos, 4, StandardCharsets.US_ASCII);
            switch (type) {
                case "VP8X" -> {
                    flagsAt = out.size() + 8;
                    width = u24le(raw, payload + 4) + 1;
                    height = u24le(raw, payload + 7) + 1;
                }
                case "VP8 " -> {
                    if (width == 0) {
                        width = u16le(raw, payload + 6) & 0x3FFF;
                        height = u16le(raw, payload + 8) & 0x3FFF;
                    }
                }
                case "VP8L" -> {
                    if (width == 0) {
                        long bits = u32le(raw, payload + 1);
                        width = (int) (bits & 0x3FFF) + 1;
                        height = (int) (bits >> 14 & 0x3FFF) + 1;
                    }
                }
                default -> {}
            }
            if (!"EXIF".equals(type) && !"XMP ".equals(type)) {
                out.write(raw, pos, end - pos);
                if ((end - pos & 1) == 1) {
                    out.write(0);
                }
            }
            pos = end;
        }

        var bytes = out.toByteArray();
        if (flagsAt >= 0) {
            bytes[flagsAt] &= (byte) ~WEBP_EXIF_AND_XMP_FLAGS;
        }
        int riffSize = bytes.length - 8;
        for (int i = 0; i < 4; i++) {
            bytes[4 + i] = (byte) (riffSize >> 8 * i);
        }
        return checked("image/webp", "webp", width, height, bytes);
    }

    // -- Helpers --

    private static InspectedImage checked(String mimeType, String extension, int width, int height, byte[] bytes) {
        if (width <= 0 || height <= 0) {
            throw new UnsupportedImageException("The image file is truncated or corrupt");
        }
        return new InspectedImage(mimeType, extension, width, height, bytes);
    }

    private static boolean startsWith(byte[] raw, int at, byte[] prefix) {
        if (raw.length - at < prefix.length) {
            return false;
        }
        for (int i = 0; i < prefix.length; i++) {
            if (raw[at + i] != prefix[i]) {
                return false;
            }
        }
        return true;
    }

    private static boolean hasAscii(byte[] raw, int at, String text) {
        return startsWith(raw, at, text.getBytes(StandardCharsets.US_ASCII));
    }

    private static int u8(byte[] raw, int at) {
        return raw[at] & 0xFF;
    }

    private static int u16be(byte[] raw, int at) {
        return u8(raw, at) << 8 | u8(raw, at + 1);
    }

    private static int u16le(byte[] raw, int at) {
        return u8(raw, at) | u8(raw, at + 1) << 8;
    }

    private static int u24le(byte[] raw, int at) {
        return u16le(raw, at) | u8(raw, at + 2) << 16;
    }

    private static long u32be(byte[] raw, int at) {
        return (long) u16be(raw, at) << 16 | u16be(raw, at + 2);
    }

    private static long u32le(byte[] raw, int at) {
        return u16le(raw, at) | (long) u16le(raw, at + 2) << 16;
    }
}
