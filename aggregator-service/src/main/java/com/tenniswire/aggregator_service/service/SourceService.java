package com.tenniswire.aggregator_service.service;

import com.tenniswire.aggregator_service.dto.SourceRegistration;
import com.tenniswire.aggregator_service.entity.HealthSnapshot;
import com.tenniswire.aggregator_service.entity.Source;
import com.tenniswire.aggregator_service.exception.ResourceNotFoundException;
import com.tenniswire.aggregator_service.repository.SourceRepository;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// The catalog of sources, written by the collector (aggregator.md 5.1)
@Service
public class SourceService {

    private final SourceRepository sources;

    public SourceService(SourceRepository sources) {
        this.sources = sources;
    }

    // The collector's whole list: what is in it is registered, or brought back; what is not, retired
    @Transactional
    public void register(SourceRegistration registration) {
        for (var entry : registration.sources()) {
            var source = sources.findById(entry.key()).orElseGet(() -> new Source().key(entry.key()));
            source.name(entry.name())
                    .language(entry.language())
                    .siteUrl(entry.siteUrl())
                    .retired(false);
            sources.save(source);
        }
        sources.flush();
        sources.retireAllBut(registration.sources().stream()
                .map(SourceRegistration.Entry::key)
                .toList());
    }

    @Transactional
    public void recordHealth(String key, HealthSnapshot snapshot) {
        var source = sources.findById(key).orElseThrow(() -> new ResourceNotFoundException("Source", key));
        source.health(snapshot).healthAt(Instant.now());
    }
}
