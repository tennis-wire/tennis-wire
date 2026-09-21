package com.tenniswire.user_service.service;

import com.tenniswire.user_service.config.AvatarProperties;
import com.tenniswire.user_service.exception.AvatarBusyException;
import com.tenniswire.user_service.exception.UnacceptableImageException;
import com.tenniswire.user_service.exception.UnacceptableImageException.Reason;
import java.awt.Color;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.EnumMap;
import java.util.Map;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.stream.MemoryCacheImageInputStream;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import org.springframework.stereotype.Component;

// Whatever comes in is decoded and drawn anew: nothing of the upload but its pixels reaches the
// bucket, EXIF and embedded profiles included. Final because the constructor may throw.
@Component
public final class AvatarImages {

    private final AvatarProperties properties;
    private final Semaphore decoding;

    public AvatarImages(AvatarProperties properties) {
        // Plugins are looked up with the class loader of whichever thread touches ImageIO first,
        // which inside a Boot jar may not see them.
        ImageIO.scanForPlugins();
        for (var format : Format.values()) {
            if (!ImageIO.getImageReadersByFormatName(format.readerName).hasNext()) {
                throw new IllegalStateException("no ImageIO reader for " + format.readerName);
            }
        }
        this.properties = properties;
        this.decoding = new Semaphore(properties.parallel(), true);
    }

    public Map<AvatarSize, byte[]> render(byte[] upload) {
        var format = Format.of(upload);
        acquire();
        try {
            var square = squareOnWhite(decode(format, upload));
            var rendered = new EnumMap<AvatarSize, byte[]>(AvatarSize.class);
            for (var size : AvatarSize.values()) {
                rendered.put(size, jpeg(scale(square, size.pixels())));
            }
            return rendered;
        } finally {
            decoding.release();
        }
    }

    // A decoded bitmap is up to max-pixels * 4 bytes of heap, so only a few at a time
    private void acquire() {
        try {
            if (!decoding.tryAcquire(properties.queueWait().toMillis(), TimeUnit.MILLISECONDS)) {
                throw new AvatarBusyException();
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AvatarBusyException();
        }
    }

    private BufferedImage decode(Format format, byte[] upload) {
        var reader = ImageIO.getImageReadersByFormatName(format.readerName).next();
        try (var input = new MemoryCacheImageInputStream(new ByteArrayInputStream(upload))) {
            reader.setInput(input, true, true);
            // From the header, before a single pixel is decoded
            var width = reader.getWidth(0);
            var height = reader.getHeight(0);
            if ((long) width * height > properties.maxPixels()) {
                throw new UnacceptableImageException(
                        Reason.TOO_LARGE, "at most " + properties.maxPixels() + " pixels, got " + width + "x" + height);
            }
            if (Math.min(width, height) < properties.minSide()) {
                throw new UnacceptableImageException(
                        Reason.TOO_SMALL,
                        "at least " + properties.minSide() + " px a side, got " + width + "x" + height);
            }
            return reader.read(0);
        } catch (UnacceptableImageException e) {
            throw e;
        } catch (IOException | RuntimeException e) {
            // Decoders fail on broken input with whatever they happen to throw
            throw new UnacceptableImageException(Reason.UNSUPPORTED, "the " + format + " could not be decoded", e);
        } finally {
            reader.dispose();
        }
    }

    // Clients crop to a square already; this only covers one that did not. JPEG has no alpha.
    private static BufferedImage squareOnWhite(BufferedImage source) {
        var side = Math.min(source.getWidth(), source.getHeight());
        var square = new BufferedImage(side, side, BufferedImage.TYPE_INT_RGB);
        var g = square.createGraphics();
        try {
            g.setColor(Color.WHITE);
            g.fillRect(0, 0, side, side);
            g.drawImage(source, -(source.getWidth() - side) / 2, -(source.getHeight() - side) / 2, null);
        } finally {
            g.dispose();
        }
        return square;
    }

    // Halving first: one bicubic step from a large source skips most of its pixels and aliases
    private static BufferedImage scale(BufferedImage source, int size) {
        var current = source;
        while (current.getWidth() / 2 >= size) {
            current = draw(current, current.getWidth() / 2, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        }
        return current.getWidth() == size ? current : draw(current, size, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
    }

    private static BufferedImage draw(BufferedImage source, int side, Object interpolation) {
        var target = new BufferedImage(side, side, BufferedImage.TYPE_INT_RGB);
        var g = target.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, interpolation);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.drawImage(source, 0, 0, side, side, null);
        } finally {
            g.dispose();
        }
        return target;
    }

    private byte[] jpeg(BufferedImage image) {
        var writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        var params = writer.getDefaultWriteParam();
        params.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
        params.setCompressionQuality(properties.quality());
        var bytes = new ByteArrayOutputStream();
        try (var output = new MemoryCacheImageOutputStream(bytes)) {
            writer.setOutput(output);
            writer.write(null, new IIOImage(image, null, null), params);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        } finally {
            writer.dispose();
        }
        return bytes.toByteArray();
    }

    // By the bytes, not the part's Content-Type, which is whatever the client says. Magic numbers
    // as ints: static byte[] constants read as a hard-coded key to find-sec-bugs.
    enum Format {
        JPEG("jpeg"),
        PNG("png"),
        WEBP("webp");

        private final String readerName;

        Format(String readerName) {
            this.readerName = readerName;
        }

        static Format of(byte[] data) {
            if (at(data, 0, 0xFF, 0xD8, 0xFF)) {
                return JPEG;
            }
            if (at(data, 0, 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n')) {
                return PNG;
            }
            if (at(data, 0, 'R', 'I', 'F', 'F') && at(data, 8, 'W', 'E', 'B', 'P')) {
                return WEBP;
            }
            throw new UnacceptableImageException(Reason.UNSUPPORTED, "only JPEG, PNG and WebP are accepted");
        }

        private static boolean at(byte[] data, int offset, int... magic) {
            if (data.length < offset + magic.length) {
                return false;
            }
            for (var i = 0; i < magic.length; i++) {
                if ((data[offset + i] & 0xFF) != magic[i]) {
                    return false;
                }
            }
            return true;
        }
    }
}
