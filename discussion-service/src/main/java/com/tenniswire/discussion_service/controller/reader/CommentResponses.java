package com.tenniswire.discussion_service.controller.reader;

import com.tenniswire.discussion_service.client.AuthorProfile;
import com.tenniswire.discussion_service.dto.reader.AuthorResponse;
import com.tenniswire.discussion_service.dto.reader.CommentCreatedResponse;
import com.tenniswire.discussion_service.dto.reader.CommentResponse;
import com.tenniswire.discussion_service.service.CommentView;
import com.tenniswire.discussion_service.service.CreatedComment;
import com.tenniswire.discussion_service.service.Visibility;
import java.util.ArrayDeque;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class CommentResponses {

    private final AuthorResponses authors;

    public CommentResponses(AuthorResponses authors) {
        this.authors = authors;
    }

    public List<CommentResponse> of(List<CommentView> views) {
        var byAuthor = authors.of(shownAuthors(views));
        return views.stream().map(view -> CommentResponse.from(view, byAuthor)).toList();
    }

    public CommentResponse of(CommentView view) {
        return of(List.of(view)).getFirst();
    }

    // The profile of someone about to write, fetched while nothing is written yet: if user-service
    // is down the request fails with nothing stored, and retrying it cannot leave a duplicate
    public @Nullable AuthorProfile profileBeforeWriting(UUID authorId) {
        var profile = authors.profile(authorId);
        if (profile == null) {
            log.warn("user-service has no profile for author {}", authorId);
        }
        return profile;
    }

    // No restriction lookup, since the write gate has just let this author through, and no call to
    // user-service, so nothing after the write can fail on its account.
    public CommentCreatedResponse created(CreatedComment created, @Nullable AuthorProfile profileFetchedBeforeWriting) {
        var comment = created.comment();
        var byAuthor = profileFetchedBeforeWriting == null
                ? Map.<UUID, AuthorResponse>of()
                : Map.of(comment.authorId(), AuthorResponse.named(profileFetchedBeforeWriting));
        var view = new CommentView(comment, Visibility.VISIBLE, false, List.of());
        return new CommentCreatedResponse(CommentResponse.from(view, byAuthor), created.mutedByRecipient());
    }

    private static Set<UUID> shownAuthors(List<CommentView> views) {
        var ids = new HashSet<UUID>();
        var pending = new ArrayDeque<>(views);
        while (!pending.isEmpty()) {
            var view = pending.pop();
            if (view.visibility().showsAuthor()) {
                ids.add(view.comment().authorId());
            }
            pending.addAll(view.replies());
        }
        return ids;
    }
}
