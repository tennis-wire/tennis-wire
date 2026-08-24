package com.tenniswire.content_service.repository;

import com.tenniswire.content_service.entity.Tag;
import com.tenniswire.content_service.entity.TagType;
import org.springframework.data.jpa.domain.Specification;

public final class TagSpecification {

    private TagSpecification() {}

    public static Specification<Tag> hasType(TagType type) {
        return (root, query, cb) -> type == null ? null : cb.equal(root.get("type"), type);
    }

    public static Specification<Tag> nameContains(String search) {
        return (root, query, cb) -> search == null || search.isBlank()
                ? null
                : cb.like(cb.lower(root.get("name")), "%" + search.toLowerCase() + "%");
    }
}
