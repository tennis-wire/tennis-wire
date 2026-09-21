package com.tenniswire.user_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.tenniswire.user_service.config.AvatarProperties;
import com.tenniswire.user_service.exception.UnacceptableImageException;
import com.tenniswire.user_service.exception.UnacceptableImageException.Reason;
import com.tenniswire.user_service.service.AvatarImages;
import com.tenniswire.user_service.service.AvatarSize;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

class AvatarImagesTest {

    // 160x120: red left half, blue right half. Lossy (VP8)
    private static final String WEBP_LOSSY = "UklGRo4AAABXRUJQVlA4IIIAAACwCACdASqgAHgAPtFor1IoJiQio7OYAQAaCWdu"
            + "4XM5QAAA18TJqrJBVLfzGFBzYQOGpequtgPs2HaTRACqXVKlc0+PKTL6+KfPgnMYTIAA/v1M9/4NkinOX//43jip0rZ4"
            + "Ej5X+le///jeOKnStuG+5P0qDC40jTldNhAOWFml+AAA";

    // 160x120: transparent left half, blue right half. Lossless (VP8L) with alpha
    private static final String WEBP_ALPHA = "UklGRioAAABXRUJQVlA4TB4AAAAvn8AdEA8wHuMxyPMf8BDTEPqX9olgEf2fAKLxpQA=";

    private static final Color RED = new Color(200, 30, 30);
    private static final Color BLUE = new Color(30, 30, 200);

    private final AvatarImages images = images(25_000_000);

    @Test
    void aJpegComesOutInBothSizes() throws IOException {
        var rendered = images.render(encode(halves(400, 400, RED, BLUE), "jpeg"));

        for (var size : AvatarSize.values()) {
            var image = read(rendered.get(size));
            assertThat(image.getWidth()).isEqualTo(size.pixels());
            assertThat(image.getHeight()).isEqualTo(size.pixels());
        }
    }

    @Test
    void aRectangleIsCutToItsMiddleSquare() throws IOException {
        // blue margins 100 px wide either side of a 200 px red middle
        var wide = new BufferedImage(400, 200, BufferedImage.TYPE_INT_RGB);
        var g = wide.createGraphics();
        g.setColor(BLUE);
        g.fillRect(0, 0, 400, 200);
        g.setColor(RED);
        g.fillRect(100, 0, 200, 200);
        g.dispose();

        var out = read(images.render(encode(wide, "png")).get(AvatarSize.LARGE));

        assertClose(out.getRGB(2, 2), RED);
        assertClose(out.getRGB(285, 285), RED);
    }

    @Test
    void transparencyBecomesWhite() throws IOException {
        var clear = new BufferedImage(200, 200, BufferedImage.TYPE_INT_ARGB);
        var g = clear.createGraphics();
        g.setColor(BLUE);
        g.fillRect(100, 0, 100, 200);
        g.dispose();

        var out = read(images.render(encode(clear, "png")).get(AvatarSize.LARGE));

        assertClose(out.getRGB(10, 144), Color.WHITE);
        assertClose(out.getRGB(278, 144), BLUE);
    }

    @Test
    void lossyWebpIsRead() throws IOException {
        var out = read(images.render(Base64.getDecoder().decode(WEBP_LOSSY)).get(AvatarSize.LARGE));

        assertClose(out.getRGB(10, 144), RED);
        assertClose(out.getRGB(278, 144), BLUE);
    }

    @Test
    void losslessWebpWithAlphaIsRead() throws IOException {
        var out = read(images.render(Base64.getDecoder().decode(WEBP_ALPHA)).get(AvatarSize.LARGE));

        assertClose(out.getRGB(10, 144), Color.WHITE);
        assertClose(out.getRGB(278, 144), BLUE);
    }

    @Test
    void nothingOfTheUploadButItsPixelsSurvives() throws IOException {
        var jpeg = withExif(encode(halves(200, 200, RED, BLUE), "jpeg"));
        assertThat(new String(jpeg, StandardCharsets.ISO_8859_1)).contains("Exif");

        for (var bytes : images.render(jpeg).values()) {
            assertThat(new String(bytes, StandardCharsets.ISO_8859_1)).doesNotContain("Exif");
        }
    }

    @Test
    void aFormatOutsideTheThreeIsRefusedByItsBytes() throws IOException {
        var gif = encode(halves(200, 200, RED, BLUE), "gif");

        assertThatThrownBy(() -> images.render(gif)).satisfies(e -> assertReason(e, Reason.UNSUPPORTED));
    }

    @Test
    void theRightMagicOverBrokenDataIsRefused() {
        var broken = new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0, 1, 2, 3, 4, 5};

        assertThatThrownBy(() -> images.render(broken)).satisfies(e -> assertReason(e, Reason.UNSUPPORTED));
    }

    @Test
    void tooFewPixelsASideIsRefused() throws IOException {
        var tiny = encode(halves(95, 200, RED, BLUE), "png");

        assertThatThrownBy(() -> images.render(tiny)).satisfies(e -> assertReason(e, Reason.TOO_SMALL));
    }

    @Test
    void tooManyPixelsIsRefusedFromTheHeader() throws IOException {
        var strict = images(200 * 200 - 1);
        var png = encode(halves(200, 200, RED, BLUE), "png");

        assertThatThrownBy(() -> strict.render(png)).satisfies(e -> assertReason(e, Reason.TOO_LARGE));
    }

    private static AvatarImages images(long maxPixels) {
        return new AvatarImages(new AvatarProperties(maxPixels, 96, 0.85f, 2, Duration.ofSeconds(5)));
    }

    private static BufferedImage halves(int width, int height, Color left, Color right) {
        var image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        var g = image.createGraphics();
        g.setColor(left);
        g.fillRect(0, 0, width / 2, height);
        g.setColor(right);
        g.fillRect(width / 2, 0, width - width / 2, height);
        g.dispose();
        return image;
    }

    private static byte[] encode(BufferedImage image, String format) throws IOException {
        var out = new ByteArrayOutputStream();
        assertThat(ImageIO.write(image, format, out)).isTrue();
        return out.toByteArray();
    }

    // An APP1 segment with an empty little-endian TIFF directory, right after SOI
    private static byte[] withExif(byte[] jpeg) {
        byte[] app1 = {
            (byte) 0xFF,
            (byte) 0xE1,
            0x00,
            0x16,
            'E',
            'x',
            'i',
            'f',
            0,
            0,
            'I',
            'I',
            0x2A,
            0x00,
            0x08,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00
        };
        var out = new byte[jpeg.length + app1.length];
        System.arraycopy(jpeg, 0, out, 0, 2);
        System.arraycopy(app1, 0, out, 2, app1.length);
        System.arraycopy(jpeg, 2, out, 2 + app1.length, jpeg.length - 2);
        return out;
    }

    private static BufferedImage read(byte[] bytes) throws IOException {
        var image = ImageIO.read(new ByteArrayInputStream(bytes));
        assertThat(image).isNotNull();
        return image;
    }

    private static void assertReason(Throwable e, Reason reason) {
        assertThat(e).isInstanceOf(UnacceptableImageException.class);
        assertThat(((UnacceptableImageException) e).reason()).isEqualTo(reason);
    }

    // JPEG moves every channel a little
    private static void assertClose(int rgb, Color expected) {
        var actual = new Color(rgb);
        assertThat(Math.abs(actual.getRed() - expected.getRed())).isLessThan(40);
        assertThat(Math.abs(actual.getGreen() - expected.getGreen())).isLessThan(40);
        assertThat(Math.abs(actual.getBlue() - expected.getBlue())).isLessThan(40);
    }
}
