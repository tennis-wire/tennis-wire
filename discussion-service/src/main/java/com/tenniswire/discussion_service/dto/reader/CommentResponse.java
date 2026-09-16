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
 * <p>{@code replyCount} is how many direct replies this viewer gets: the ones his own
 * subtree_removal takes out are not counted. Only direct replies are taken off, so a reply that is
 * a placeholder with everything under it removed for him still counts.
 *
 * <p>{@code repliesTruncated} means this response carries fewer direct replies than the viewer
 * gets, so there are more to ask for. Where it is set, the replies of that node are read through
 * {@code GET /comments/&#123;id&#125;/replies}, from its first page: the branch hands out a prefix,
 * not a position to resume from.
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
        boolean repliesTruncated,
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
                view.replyCount(),
                view.repliesTruncated(),
                c.createdAt(),
                c.updatedAt(),
                view.replies().stream().map(reply -> from(reply, authors)).toList());
    }
}
