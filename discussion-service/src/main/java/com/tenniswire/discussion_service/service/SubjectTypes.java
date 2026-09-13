package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.exception.UnknownSubjectTypeException;
import java.util.Collection;
import java.util.Set;
import org.jspecify.annotations.Nullable;

public class SubjectTypes {

    private final Set<String> known;

    public SubjectTypes(@Nullable Collection<String> known) {
        // An empty list would make the service refuse every comment and every listing, which on a
        // running site looks like a broken database rather than a missing property.
        if (known == null || known.isEmpty()) {
            throw new IllegalStateException("discussion.subject-types is empty: nothing could be commented on");
        }
        this.known = Set.copyOf(known);
    }

    public void assertKnown(String subjectType) {
        if (!known.contains(subjectType)) {
            throw new UnknownSubjectTypeException(subjectType);
        }
    }
}
