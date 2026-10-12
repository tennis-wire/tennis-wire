package com.tenniswire.aggregator_service.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

// No @Valid on the items: each is checked on its own, so one bad item does not turn the batch away
public record IngestRequest(@NotNull @Size(max = 100) List<IncomingItem> items) {}
