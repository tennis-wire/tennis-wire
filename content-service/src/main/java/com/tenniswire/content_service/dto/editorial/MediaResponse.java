package com.tenniswire.content_service.dto.editorial;

import com.tenniswire.content_service.entity.Media;
import java.util.UUID;

public record MediaResponse(UUID id, String url, String mimeType, Long sizeBytes, Integer width, Integer height) {

    public static MediaResponse from(Media media) {
        return new MediaResponse(
                media.id(), media.url(), media.mimeType(), media.sizeBytes(), media.width(), media.height());
    }
}
