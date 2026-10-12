package com.tenniswire.aggregator_service.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.tenniswire.aggregator_service.entity.Extraction;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;

// One item of a batch, checked on its own: a bad one is rejected and the rest go in. A new item
// brings everything; an update brings the address and what changed, and an absent field is kept.
public record IncomingItem(
        @NotNull Change change,
        @NotBlank @Size(max = 2000) String url,
        @Size(max = 100) String source,
        @Size(max = 2000) String externalId,
        @Size(max = 1000) String title,
        @Size(max = 10_000) String lead,
        @Size(max = 200_000) String text,
        @Size(max = 500) String author,
        @Size(max = 2000) String imageUrl,
        Instant publishedAt,
        Instant firstSeenAt,
        @Pattern(regexp = "^[a-z]{2,3}$") String language,
        @Size(max = 50) List<@NotBlank @Size(max = 300) String> categories,
        @Size(max = 50) List<@NotBlank @Size(max = 2000) String> embeds,
        Extraction extraction,
        @Size(max = 2000) String extractionError) {

    public enum Change {
        @JsonProperty("new")
        NEW,
        // A retry brought the text, or the feed changed the title or date (aggregator.md 4.4)
        @JsonProperty("update")
        UPDATE
    }
}
