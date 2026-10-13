package com.tenniswire.aggregator_service.dto.editorial;

import com.tenniswire.aggregator_service.entity.Extraction;
import com.tenniswire.aggregator_service.entity.Item;
import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

// One card of the feed: no text, the panel asks for the item whole
public record ItemCardResponse(
        UUID id,
        String source,
        String language,
        String title,
        @Nullable String titleBefore,
        @Nullable String lead,
        @Nullable Instant publishedAt,
        Instant arrivedAt,
        Extraction extraction,
        boolean hasEmbeds) {

    public static ItemCardResponse of(Item item) {
        return new ItemCardResponse(
                item.id(),
                item.sourceKey(),
                item.language(),
                item.title(),
                item.titleBefore(),
                item.lead(),
                item.publishedAt(),
                item.createdAt(),
                item.extraction(),
                !item.embeds().isEmpty());
    }
}
