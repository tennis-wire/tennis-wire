package com.tenniswire.user_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.tenniswire.user_service.client.AvatarStorage;
import com.tenniswire.user_service.exception.StorageUnavailableException;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

class AvatarStorageTest {

    private final S3Client s3 = mock(S3Client.class);
    private final AvatarStorage storage = new AvatarStorage(s3, "avatars", "public, max-age=31536000, immutable");

    @Test
    void anObjectGoesInAsAJpegThatNeverChanges() {
        storage.put("96/u/k.jpg", new byte[] {1, 2, 3});

        var request = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3).putObject(request.capture(), any(RequestBody.class));
        assertThat(request.getValue().bucket()).isEqualTo("avatars");
        assertThat(request.getValue().key()).isEqualTo("96/u/k.jpg");
        assertThat(request.getValue().contentType()).isEqualTo("image/jpeg");
        assertThat(request.getValue().cacheControl()).isEqualTo("public, max-age=31536000, immutable");
    }

    @Test
    void aBucketThatDoesNotAnswerIsTheServicesOwnException() {
        given(s3.deleteObject(any(DeleteObjectRequest.class))).willThrow(SdkClientException.create("down"));

        assertThatThrownBy(() -> storage.delete("96/u/k.jpg")).isInstanceOf(StorageUnavailableException.class);
    }
}
