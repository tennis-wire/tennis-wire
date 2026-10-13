package com.tenniswire.aggregator_service.dto.editorial;

import com.tenniswire.aggregator_service.entity.HealthSnapshot;
import com.tenniswire.aggregator_service.entity.Source;
import java.time.Instant;
import org.jspecify.annotations.Nullable;

// A source for the feed's filter and its health line. healthAt is when the collector last sent a
// snapshot: it does at least every 15 minutes, so all of them old means the collector itself is down
public record SourceResponse(
        String key,
        String name,
        String language,
        String siteUrl,
        boolean retired,
        @Nullable HealthSnapshot health,
        @Nullable Instant healthAt) {

    public static SourceResponse of(Source source) {
        return new SourceResponse(
                source.key(),
                source.name(),
                source.language(),
                source.siteUrl(),
                source.retired(),
                source.health(),
                source.healthAt());
    }
}
