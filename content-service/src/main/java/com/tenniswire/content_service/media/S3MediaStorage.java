package com.tenniswire.content_service.media;

import com.tenniswire.content_service.config.MediaProperties;
import com.tenniswire.content_service.exception.StorageUnavailableException;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

@Component
public class S3MediaStorage implements MediaStorage {

    // A key is written once and never again, so a copy that was fetched stays good
    private static final String CACHE_CONTROL = "public, max-age=31536000, immutable";

    private final S3Client s3;
    private final String bucket;

    public S3MediaStorage(S3Client s3, MediaProperties properties) {
        this.s3 = s3;
        this.bucket = properties.s3().bucket();
    }

    @Override
    public void put(String key, byte[] bytes, String contentType) {
        var request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(contentType)
                .cacheControl(CACHE_CONTROL)
                .build();
        try {
            s3.putObject(request, RequestBody.fromBytes(bytes));
        } catch (SdkException e) {
            throw new StorageUnavailableException("Object storage did not take the upload", e);
        }
    }
}
