package com.tenniswire.aggregator_service.controller;

import com.tenniswire.aggregator_service.dto.SourceRegistration;
import com.tenniswire.aggregator_service.entity.HealthSnapshot;
import com.tenniswire.aggregator_service.service.SourceService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/sources")
public class InternalSourceController {

    private final SourceService sources;

    public InternalSourceController(SourceService sources) {
        this.sources = sources;
    }

    @PutMapping
    public ResponseEntity<Void> register(@Valid @RequestBody SourceRegistration registration) {
        sources.register(registration);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{key}/health")
    public ResponseEntity<Void> health(@PathVariable String key, @Valid @RequestBody HealthSnapshot snapshot) {
        sources.recordHealth(key, snapshot);
        return ResponseEntity.noContent().build();
    }
}
