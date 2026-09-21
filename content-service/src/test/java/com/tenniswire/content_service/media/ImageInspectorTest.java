package com.tenniswire.content_service.media;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.tenniswire.content_service.exception.UnsupportedImageException;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.junit.jupiter.api.Test;

class ImageInspectorTest {

    @Test
    void jpegLosesItsMetadataAndWhatFollowsTheImage() {
        var raw = TestImages.jpeg(320, 200, 1, ByteOrder.BIG_ENDIAN);

        var image = ImageInspector.inspect(raw);

        assertThat(image.mimeType()).isEqualTo("image/jpeg");
        assertThat(image.extension()).isEqualTo("jpg");
        assertThat(image.width()).isEqualTo(320);
        assertThat(image.height()).isEqualTo(200);
        assertThat(TestImages.contains(raw, TestImages.SECRET)).isTrue();
        assertThat(TestImages.contains(image.bytes(), TestImages.SECRET)).isFalse();
        assertThat(TestImages.contains(image.bytes(), "Exif")).isFalse();
        assertThat(TestImages.contains(image.bytes(), "JFIF")).isTrue();
    }

    @Test
    void jpegScanIsCopiedByteForByte() {
        var image = ImageInspector.inspect(TestImages.jpeg(320, 200, 1, ByteOrder.BIG_ENDIAN));

        var scan = new byte[] {0x11, (byte) 0xFF, 0x00, 0x22, (byte) 0xFF, (byte) 0xD0, 0x33, (byte) 0xFF, (byte) 0xD9};
        var bytes = image.bytes();
        assertThat(Arrays.copyOfRange(bytes, bytes.length - scan.length, bytes.length))
                .isEqualTo(scan);
    }

    @Test
    void jpegKeepsOrientationAndReportsTheSizeAsDrawn() {
        for (var order : new ByteOrder[] {ByteOrder.BIG_ENDIAN, ByteOrder.LITTLE_ENDIAN}) {
            var image = ImageInspector.inspect(TestImages.jpeg(320, 200, 6, order));

            assertThat(image.width()).isEqualTo(200);
            assertThat(image.height()).isEqualTo(320);
            assertThat(TestImages.contains(image.bytes(), TestImages.SECRET)).isFalse();
            // what is left of the Exif block: tag 0x0112, SHORT, count 1, value 6
            var entry = new byte[] {0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6};
            assertThat(TestImages.contains(image.bytes(), entry)).isTrue();
        }
    }

    @Test
    void pngLosesItsTextChunks() {
        var image = ImageInspector.inspect(TestImages.png(64, 48));

        assertThat(image.mimeType()).isEqualTo("image/png");
        assertThat(image.width()).isEqualTo(64);
        assertThat(image.height()).isEqualTo(48);
        assertThat(TestImages.contains(image.bytes(), TestImages.SECRET)).isFalse();
        assertThat(TestImages.contains(image.bytes(), "IDAT")).isTrue();
        assertThat(TestImages.contains(image.bytes(), "IEND")).isTrue();
    }

    @Test
    void webpLosesItsMetadataChunksAndTheFlagsThatAnnounceThem() {
        var image = ImageInspector.inspect(TestImages.webp(100, 60));
        var bytes = image.bytes();

        assertThat(image.mimeType()).isEqualTo("image/webp");
        assertThat(image.width()).isEqualTo(100);
        assertThat(image.height()).isEqualTo(60);
        assertThat(TestImages.contains(bytes, TestImages.SECRET)).isFalse();
        assertThat(TestImages.contains(bytes, "VP8 ")).isTrue();
        // RIFF header (12) + chunk header (8): the first byte of VP8X is its flags
        assertThat(bytes[20]).isEqualTo((byte) 0);
        int riffSize = bytes[4] & 0xFF | (bytes[5] & 0xFF) << 8 | (bytes[6] & 0xFF) << 16 | (bytes[7] & 0xFF) << 24;
        assertThat(riffSize).isEqualTo(bytes.length - 8);
    }

    @Test
    void theFormatIsReadFromTheBytesNotFromTheName() {
        var html = "<html><script>alert(1)</script></html>".getBytes(StandardCharsets.US_ASCII);

        assertThatThrownBy(() -> ImageInspector.inspect(html)).isInstanceOf(UnsupportedImageException.class);
        assertThatThrownBy(() -> ImageInspector.inspect(new byte[0])).isInstanceOf(UnsupportedImageException.class);
    }

    @Test
    void aTruncatedFileIsRefusedRatherThanCrashingTheParser() {
        var png = TestImages.png(64, 48);
        var jpeg = TestImages.jpeg(320, 200, 6, ByteOrder.BIG_ENDIAN);

        assertThatThrownBy(() -> ImageInspector.inspect(Arrays.copyOf(png, 20)))
                .isInstanceOf(UnsupportedImageException.class);
        assertThatThrownBy(() -> ImageInspector.inspect(Arrays.copyOf(jpeg, 30)))
                .isInstanceOf(UnsupportedImageException.class);
    }
}
