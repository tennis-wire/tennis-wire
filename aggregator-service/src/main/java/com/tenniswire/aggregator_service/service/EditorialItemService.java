package com.tenniswire.aggregator_service.service;

import com.tenniswire.aggregator_service.dto.editorial.ItemCardResponse;
import com.tenniswire.aggregator_service.dto.editorial.ItemPageResponse;
import com.tenniswire.aggregator_service.dto.editorial.ItemResponse;
import com.tenniswire.aggregator_service.entity.Item;
import com.tenniswire.aggregator_service.exception.ResourceNotFoundException;
import com.tenniswire.aggregator_service.repository.ItemRepository;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Locale;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// The newsroom's side of the feed (aggregator.md 5.2)
@Service
public class EditorialItemService {

    private static final Logger log = LoggerFactory.getLogger(EditorialItemService.class);

    private static final Sort NEWEST_FIRST =
            Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id"));

    private final ItemRepository items;

    public EditorialItemService(ItemRepository items) {
        this.items = items;
    }

    public record Filter(
            Collection<String> sources,
            Collection<String> languages,
            @Nullable String search) {}

    // Newest arrival first: the order the collector brought them in
    @Transactional(readOnly = true)
    public ItemPageResponse feed(Filter filter, int limit, @Nullable String cursor) {
        var spec = matching(filter).and(after(ItemCursor.decode(cursor)));
        var found = items.findBy(
                spec, query -> query.sortBy(NEWEST_FIRST).limit(limit + 1).all());
        var page = found.size() > limit ? found.subList(0, limit) : found;
        var next = found.size() > limit ? ItemCursor.encode(page.getLast()) : null;
        return new ItemPageResponse(page.stream().map(ItemCardResponse::of).toList(), next);
    }

    @Transactional(readOnly = true)
    public ItemResponse get(UUID id) {
        return items.findById(id).map(ItemResponse::of).orElseThrow(() -> new ResourceNotFoundException("Item", id));
    }

    // The editor finds the original of a draft by its source address
    @Transactional(readOnly = true)
    public ItemResponse byUrl(String url) {
        return items.findByUrl(url).map(ItemResponse::of).orElseThrow(() -> new ResourceNotFoundException("Item", url));
    }

    // Gone whole, for everyone; an item already gone is no error: two people may clear the same one
    @Transactional
    public void delete(UUID id, String who) {
        items.findById(id).ifPresent(item -> {
            items.delete(item);
            log.info("Item {} ({}) deleted by {}", item.id(), item.url(), who);
        });
    }

    private static Specification<Item> matching(Filter filter) {
        return (root, query, cb) -> {
            var predicates = new ArrayList<Predicate>();
            if (!filter.sources().isEmpty()) {
                predicates.add(root.get("sourceKey").in(filter.sources()));
            }
            if (!filter.languages().isEmpty()) {
                predicates.add(root.get("language").in(filter.languages()));
            }
            var search = filter.search();
            if (search != null && !search.isBlank()) {
                // A substring in any language: the trigram indexes on lower(title) and lower(lead)
                var pattern = "%" + escapeLike(search.strip().toLowerCase(Locale.ROOT)) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("title")), pattern, '\\'),
                        cb.like(cb.lower(root.get("lead")), pattern, '\\')));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static Specification<Item> after(ItemCursor.@Nullable Position position) {
        return (root, query, cb) -> {
            if (position == null) {
                return cb.conjunction();
            }
            return cb.or(
                    cb.lessThan(root.get("createdAt"), position.createdAt()),
                    cb.and(
                            cb.equal(root.get("createdAt"), position.createdAt()),
                            cb.lessThan(root.<UUID>get("id"), position.id())));
        };
    }

    static String escapeLike(String text) {
        return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
