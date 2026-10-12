package com.tenniswire.aggregator_service.service;

import com.tenniswire.aggregator_service.repository.ItemRepository;
import java.time.Instant;
import java.util.OptionalInt;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class ExpiryWriter {

    private final ItemRepository items;

    ExpiryWriter(ItemRepository items) {
        this.items = items;
    }

    // One batch of items that arrived before the cutoff, deleted whole. Empty when another instance
    // holds the pass.
    @Transactional
    OptionalInt delete(Instant cutoff, int size) {
        if (!items.tryLockExpiry()) {
            return OptionalInt.empty();
        }
        return OptionalInt.of(items.deleteArrivedBefore(cutoff, size));
    }
}
