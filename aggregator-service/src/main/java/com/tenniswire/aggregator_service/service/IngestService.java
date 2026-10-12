package com.tenniswire.aggregator_service.service;

import com.tenniswire.aggregator_service.dto.IncomingItem;
import com.tenniswire.aggregator_service.dto.IncomingItem.Change;
import com.tenniswire.aggregator_service.dto.IngestResponse;
import com.tenniswire.aggregator_service.dto.IngestResponse.Outcome;
import com.tenniswire.aggregator_service.dto.IngestResponse.Result;
import com.tenniswire.aggregator_service.entity.Extraction;
import com.tenniswire.aggregator_service.entity.Item;
import com.tenniswire.aggregator_service.repository.ItemRepository;
import com.tenniswire.aggregator_service.repository.SourceRepository;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

// News from the collector (aggregator.md 5.1). Every item is checked and written on its own, in a
// transaction of its own: a bad one is rejected, the rest of the batch goes in.
@Service
public class IngestService {

    private final ItemRepository items;
    private final SourceRepository sources;
    private final Validator validator;
    private final TransactionTemplate transactions;

    public IngestService(
            ItemRepository items, SourceRepository sources, Validator validator, TransactionTemplate transactions) {
        this.items = items;
        this.sources = sources;
        this.validator = validator;
        this.transactions = transactions;
    }

    public IngestResponse ingest(List<IncomingItem> batch) {
        return new IngestResponse(batch.stream().map(this::one).toList());
    }

    private Result one(IncomingItem incoming) {
        var url = incoming == null ? null : incoming.url();
        var problem = problemWith(incoming);
        if (problem != null) {
            return new Result(url, Outcome.REJECTED, problem);
        }
        try {
            return transactions.execute(status -> apply(incoming));
        } catch (DataIntegrityViolationException e) {
            // Another request inserted the same address in between: now it is there to update
            return transactions.execute(status -> apply(incoming));
        }
    }

    private String problemWith(IncomingItem incoming) {
        if (incoming == null) {
            return "empty item";
        }
        Set<ConstraintViolation<IncomingItem>> violations = validator.validate(incoming);
        if (!violations.isEmpty()) {
            return violations.stream()
                    .map(v -> v.getPropertyPath() + " " + v.getMessage())
                    .sorted(Comparator.naturalOrder())
                    .collect(Collectors.joining("; "));
        }
        if (!isWebAddress(incoming.url())) {
            return "url must be an absolute http or https address";
        }
        if (incoming.change() == Change.NEW) {
            var missing = new ArrayList<String>();
            if (blank(incoming.source())) missing.add("source");
            if (blank(incoming.externalId())) missing.add("externalId");
            if (blank(incoming.title())) missing.add("title");
            if (incoming.firstSeenAt() == null) missing.add("firstSeenAt");
            if (blank(incoming.language())) missing.add("language");
            if (incoming.extraction() == null) missing.add("extraction");
            if (!missing.isEmpty()) {
                return "a new item needs " + String.join(", ", missing);
            }
        }
        return null;
    }

    private Result apply(IncomingItem incoming) {
        var existing = items.findByUrl(incoming.url());
        if (existing.isPresent()) {
            merge(existing.get(), incoming);
            return Result.of(incoming.url(), Outcome.UPDATED);
        }
        if (incoming.change() == Change.UPDATE) {
            // Deleted, and staying so: a retry or a changed title does not bring it back
            return Result.of(incoming.url(), Outcome.IGNORED);
        }
        if (!sources.existsById(incoming.source())) {
            return new Result(incoming.url(), Outcome.REJECTED, "unknown source " + incoming.source());
        }
        var item = new Item().url(incoming.url()).sourceKey(incoming.source());
        merge(item, incoming);
        items.saveAndFlush(item);
        return Result.of(incoming.url(), Outcome.CREATED);
    }

    // What came overwrites, what did not is kept. The source is never changed: a second source sending
    // the same address leaves the item with the first.
    private static void merge(Item item, IncomingItem incoming) {
        if (incoming.title() != null && !incoming.title().equals(item.title())) {
            if (item.title() != null) {
                item.titleBefore(item.title());
            }
            item.title(incoming.title());
        }
        if (incoming.externalId() != null) item.externalId(incoming.externalId());
        if (incoming.lead() != null) item.lead(incoming.lead());
        if (incoming.text() != null) item.text(incoming.text());
        if (incoming.author() != null) item.author(incoming.author());
        if (incoming.imageUrl() != null) item.imageUrl(incoming.imageUrl());
        if (incoming.publishedAt() != null) item.publishedAt(incoming.publishedAt());
        if (incoming.firstSeenAt() != null && item.firstSeenAt() == null) item.firstSeenAt(incoming.firstSeenAt());
        if (incoming.language() != null) item.language(incoming.language());
        if (incoming.categories() != null) item.categories(new ArrayList<>(incoming.categories()));
        if (incoming.embeds() != null) item.embeds(new ArrayList<>(incoming.embeds()));
        if (incoming.extraction() != null) {
            item.extraction(incoming.extraction());
            // The error belongs to the outcome it came with: text got clears it
            item.extractionError(incoming.extraction() == Extraction.OK ? null : incoming.extractionError());
        }
    }

    private static boolean isWebAddress(String url) {
        try {
            var uri = new URI(url);
            var scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            return (scheme.equals("http") || scheme.equals("https")) && uri.getHost() != null;
        } catch (URISyntaxException e) {
            return false;
        }
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
