package com.tenniswire.content_service.dto.pub;

import com.tenniswire.content_service.entity.Tag;

public record SectionResponse(String name, String slug, String description, String icon) {

    public static SectionResponse from(Tag tag) {
        return new SectionResponse(tag.name(), tag.slug(), tag.description(), tag.icon());
    }
}
