package com.tenniswire.aggregator_service.dto.editorial;

import com.tenniswire.aggregator_service.entity.Extraction;
import com.tenniswire.aggregator_service.entity.Item;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

// The item whole, for the panel and the editor's original. text is markdown from a foreign site:
// the client renders it as markdown, never as HTML
public record ItemResponse(
        UUID id,
        String url,
        String source,
        String language,
        String title,
        @Nullable String titleBefore,
        @Nullable String lead,
        @Nullable String text,
        @Nullable String author,
        @Nullable String imageUrl,
        @Nullable Instant publishedAt,
        Instant arrivedAt,
        List<String> categories,
        List<String> embeds,
        Extraction extraction) {

    public static ItemResponse of(Item item) {
        return new ItemResponse(
                item.id(),
                item.url(),
                item.sourceKey(),
                item.language(),
                item.title(),
                item.titleBefore(),
                item.lead(),
                item.text(),
                item.author(),
                item.imageUrl(),
                item.publishedAt(),
                item.createdAt(),
                List.copyOf(item.categories()),
                List.copyOf(item.embeds()),
                item.extraction());
    }
}
