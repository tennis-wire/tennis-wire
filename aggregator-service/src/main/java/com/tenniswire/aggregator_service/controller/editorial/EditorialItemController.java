package com.tenniswire.aggregator_service.controller.editorial;

import com.tenniswire.aggregator_service.dto.editorial.ItemPageResponse;
import com.tenniswire.aggregator_service.dto.editorial.ItemResponse;
import com.tenniswire.aggregator_service.service.EditorialItemService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// No @Validated: Spring's own method validation then answers 400 (HandlerMethodValidationException)
@RestController
@RequestMapping("/api/aggregator/items")
public class EditorialItemController {

    private final EditorialItemService service;

    public EditorialItemController(EditorialItemService service) {
        this.service = service;
    }

    // source and language repeat: ?source=a&source=b
    @GetMapping
    public ItemPageResponse feed(
            @RequestParam(name = "source", required = false) @Size(max = 200) @Nullable List<String> sources,
            @RequestParam(name = "language", required = false) @Size(max = 50) @Nullable List<String> languages,
            @RequestParam(required = false) @Size(max = 200) @Nullable String search,
            @RequestParam(defaultValue = "50") @Min(1) @Max(100) int limit,
            @RequestParam(required = false) @Nullable String cursor) {
        var filter = new EditorialItemService.Filter(
                sources == null ? List.of() : sources, languages == null ? List.of() : languages, search);
        return service.feed(filter, limit, cursor);
    }

    // A literal, so it wins over /{id}
    @GetMapping("/by-url")
    public ItemResponse byUrl(@RequestParam @Size(max = 2000) String url) {
        return service.byUrl(url);
    }

    @GetMapping("/{id}")
    public ItemResponse get(@PathVariable UUID id) {
        return service.get(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id, JwtAuthenticationToken token) {
        var name = token.getToken().getClaimAsString("preferred_username");
        service.delete(id, name == null ? token.getName() : name + " (" + token.getName() + ")");
        return ResponseEntity.noContent().build();
    }
}
