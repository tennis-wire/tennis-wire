package com.tenniswire.discussion_service.dto.reader;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.tenniswire.discussion_service.service.CommentView;
import com.tenniswire.discussion_service.service.Visibility;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * A comment as the current viewer may see it. {@code body} and {@code author} are withheld
 * according to {@code visibility} (see {@link Visibility}); {@code author} is also missing when
 * user-service has no profile for the author. {@code replies} is empty on top-level listings and on
 * ancestry chains, populated on a branch.
 *
 * <p>{@code replyCount} is the raw direct-reply count and may exceed what a blocking viewer will
 * actually get back (spec §13).
 */
public record CommentResponse(
        UUID id,
        String subjectType,
        UUID subjectId,
        UUID inReplyToId,
        UUID rootId,
        @JsonInclude(JsonInclude.Include.NON_NULL) AuthorResponse author,
        @JsonInclude(JsonInclude.Include.NON_NULL) String body,
        String visibility,
        int replyCount,
        Instant createdAt,
        Instant updatedAt,
        List<CommentResponse> replies) {

    public static CommentResponse from(CommentView view, Map<UUID, AuthorResponse> authors) {
        var c = view.comment();
        var visibility = view.visibility();
        var showBody = visibility == Visibility.VISIBLE || visibility == Visibility.SOFT_HIDDEN;
        return new CommentResponse(
                c.id(),
                c.subjectType(),
                c.subjectId(),
                c.inReplyToId(),
                c.rootId(),
                visibility.showsAuthor() ? authors.get(c.authorId()) : null,
                showBody ? c.body() : null,
                visibility.value(),
                c.replyCount(),
                c.createdAt(),
                c.updatedAt(),
                view.replies().stream().map(reply -> from(reply, authors)).toList());
    }
}
