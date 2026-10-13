package com.tenniswire.aggregator_service.controller.editorial;

import com.tenniswire.aggregator_service.dto.editorial.SourceResponse;
import com.tenniswire.aggregator_service.repository.SourceRepository;
import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/aggregator/sources")
public class EditorialSourceController {

    private final SourceRepository sources;

    public EditorialSourceController(SourceRepository sources) {
        this.sources = sources;
    }

    // Retired ones too: their items live out their term and are still filtered by source
    @GetMapping
    @Transactional(readOnly = true)
    public List<SourceResponse> list() {
        return sources.findAll(Sort.by("name")).stream().map(SourceResponse::of).toList();
    }
}
