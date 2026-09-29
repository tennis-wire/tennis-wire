package com.tenniswire.content_service.dto.editorial;

import java.util.Set;
import java.util.UUID;

// What a create and a save both carry, under the same names
public interface ArticleFields {

    String title();

    String subtitle();

    String content();

    String coverImageUrl();

    String coverAlt();

    String coverCaption();

    String coverCredit();

    String coverCreditKind();

    String sourceUrl();

    String sourceName();

    Set<UUID> tagIds();
}
