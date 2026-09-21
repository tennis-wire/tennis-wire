package com.tenniswire.content_service.service;

import com.tenniswire.content_service.config.MediaProperties;
import com.tenniswire.content_service.dto.editorial.MediaResponse;
import com.tenniswire.content_service.entity.Media;
import com.tenniswire.content_service.entity.MediaType;
import com.tenniswire.content_service.exception.UnsupportedImageException;
import com.tenniswire.content_service.media.ImageInspector;
import com.tenniswire.content_service.media.MediaStorage;
import com.tenniswire.content_service.repository.MediaRepository;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

// Not transactional on purpose: the row is a single insert, and the upload in front of it should
// not hold a database connection while it talks to the object storage.
@Service
public class MediaService {

    private static final DateTimeFormatter MONTH =
            DateTimeFormatter.ofPattern("yyyy/MM").withZone(ZoneOffset.UTC);

    private final MediaRepository mediaRepository;
    private final MediaStorage storage;
    private final String publicBaseUrl;
    private final long maxPixels;

    public MediaService(MediaRepository mediaRepository, MediaStorage storage, MediaProperties properties) {
        this.mediaRepository = mediaRepository;
        this.storage = storage;
        this.publicBaseUrl = properties.publicBaseUrl().toString().replaceAll("/+$", "");
        this.maxPixels = properties.maxPixels();
    }

    public MediaResponse uploadImage(MultipartFile file) {
        var image = ImageInspector.inspect(bytesOf(file));
        // The file is never decoded here, but a reader's phone has to decode it
        if ((long) image.width() * image.height() > maxPixels) {
            throw new UnsupportedImageException("The image has more than %d pixels".formatted(maxPixels));
        }

        // Random and never reused: the URL ends up inside article HTML, and an object that could
        // change under it could not be cached forever.
        var key = "%s/%s.%s".formatted(MONTH.format(Instant.now()), UUID.randomUUID(), image.extension());
        storage.put(key, image.bytes(), image.mimeType());

        // A row that fails to save leaves an object nobody links to, which costs only its bytes
        var media = new Media();
        media.type(MediaType.IMAGE);
        media.url(publicBaseUrl + "/" + key);
        media.mimeType(image.mimeType());
        media.sizeBytes((long) image.bytes().length);
        media.width(image.width());
        media.height(image.height());
        return MediaResponse.from(mediaRepository.save(media));
    }

    private static byte[] bytesOf(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
