package com.tenniswire.aggregator_service.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

// The collector's whole list of sources: whatever is not in it is retired. Never empty: an empty list
// would retire everything, and that is a broken collector rather than a decision.
public record SourceRegistration(
        @NotEmpty @Size(max = 500) @Valid List<Entry> sources) {

    public record Entry(
            @NotBlank @Size(max = 100) @Pattern(regexp = "^[a-z0-9]+(-[a-z0-9]+)*$")
            String key,

            @NotBlank @Size(max = 200) String name,
            @NotBlank @Pattern(regexp = "^[a-z]{2,3}$") String language,

            @NotBlank @Size(max = 2000) @Pattern(regexp = "^https?://.+") String siteUrl) {}
}
