package com.tenniswire.content_service.dto.editorial;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Set;
import java.util.UUID;

public record CreateArticleRequest(
        @NotNull String type,
        @NotBlank @Size(max = 500) String title,
        String subtitle,
        @Size(max = 500) @Pattern(regexp = SLUG_PATTERN) String slug,
        String content,
        @Size(max = 2000) String coverImageUrl,
        @Size(max = 500) String coverAlt,
        @Size(max = 500) String coverCaption,
        @Size(max = 300) String coverCredit,

        @Pattern(regexp = CREDIT_KIND_PATTERN) String coverCreditKind,

        @Size(max = 2000) String sourceUrl,
        @Size(max = 300) String sourceName,
        Set<UUID> tagIds,
        String aggregatorItemId)
        implements ArticleFields {

    // What the generator produces from a title, so a slug set by hand looks the same
    public static final String SLUG_PATTERN = "^[a-z0-9]+(-[a-z0-9]+)*$";

    public static final String CREDIT_KIND_PATTERN = "^(photo|illustration|screenshot)$";
}
