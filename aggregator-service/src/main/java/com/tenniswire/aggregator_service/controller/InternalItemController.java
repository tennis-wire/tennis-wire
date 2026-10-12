package com.tenniswire.aggregator_service.controller;

import com.tenniswire.aggregator_service.dto.IngestRequest;
import com.tenniswire.aggregator_service.dto.IngestResponse;
import com.tenniswire.aggregator_service.service.IngestService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/items")
public class InternalItemController {

    private final IngestService ingest;

    public InternalItemController(IngestService ingest) {
        this.ingest = ingest;
    }

    // 200 with a result per item, whatever became of each: a rejected item is not a failed request
    @PostMapping
    public IngestResponse ingest(@Valid @RequestBody IngestRequest request) {
        return ingest.ingest(request.items());
    }
}
