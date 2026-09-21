package com.tenniswire.user_service.client;

import com.tenniswire.user_service.exception.StorageUnavailableException;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

// One object per call. DeleteObjects would save a round trip but needs a checksum header that not
// every S3 clone takes.
public class AvatarStorage {

    private static final String JPEG = "image/jpeg";

    private final S3Client s3;
    private final String bucket;
    private final String cacheControl;

    public AvatarStorage(S3Client s3, String bucket, String cacheControl) {
        this.s3 = s3;
        this.bucket = bucket;
        this.cacheControl = cacheControl;
    }

    public void put(String objectKey, byte[] jpeg) {
        try {
            s3.putObject(
                    PutObjectRequest.builder()
                            .bucket(bucket)
                            .key(objectKey)
                            .contentType(JPEG)
                            .cacheControl(cacheControl)
                            .build(),
                    RequestBody.fromBytes(jpeg));
        } catch (SdkException e) {
            throw new StorageUnavailableException("could not store " + objectKey, e);
        }
    }

    // Succeeds for a key that is not there, so it is safe to repeat
    public void delete(String objectKey) {
        try {
            s3.deleteObject(
                    DeleteObjectRequest.builder().bucket(bucket).key(objectKey).build());
        } catch (SdkException e) {
            throw new StorageUnavailableException("could not delete " + objectKey, e);
        }
    }
}
