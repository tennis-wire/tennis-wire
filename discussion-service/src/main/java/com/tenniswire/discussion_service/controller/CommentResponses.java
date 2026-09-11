package com.tenniswire.discussion_service.controller;

import com.tenniswire.discussion_service.client.AuthorProfile;
import com.tenniswire.discussion_service.client.AuthorProfileClient;
import com.tenniswire.discussion_service.dto.AuthorResponse;
import com.tenniswire.discussion_service.dto.CommentCreatedResponse;
import com.tenniswire.discussion_service.dto.CommentResponse;
import com.tenniswire.discussion_service.entity.UserRestriction;
import com.tenniswire.discussion_service.repository.UserRestrictionRepository;
import com.tenniswire.discussion_service.service.CommentView;
import com.tenniswire.discussion_service.service.CreatedComment;
import com.tenniswire.discussion_service.service.Visibility;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.HashMap;
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

    private final AuthorProfileClient profiles;
    private final UserRestrictionRepository restrictions;

    public CommentResponses(AuthorProfileClient profiles, UserRestrictionRepository restrictions) {
        this.profiles = profiles;
        this.restrictions = restrictions;
    }

    public List<CommentResponse> of(List<CommentView> views) {
        var authors = authorsOf(shownAuthors(views));
        return views.stream().map(view -> CommentResponse.from(view, authors)).toList();
    }

    public CommentResponse of(CommentView view) {
        return of(List.of(view)).getFirst();
    }

    // The profile of someone about to write, fetched while nothing is written yet: if user-service
    // is down the request fails with nothing stored, and retrying it cannot leave a duplicate
    public @Nullable AuthorProfile profileBeforeWriting(UUID authorId) {
        var profile = profiles.profiles(List.of(authorId)).get(authorId);
        if (profile == null) {
            log.warn("user-service has no profile for author {}", authorId);
        }
        return profile;
    }

    // No restriction lookup, since the write gate has just let this author through, and no call to
    // user-service, so nothing after the write can fail on its account.
    public CommentCreatedResponse created(CreatedComment created, @Nullable AuthorProfile profileFetchedBeforeWriting) {
        var comment = created.comment();
        var authors = profileFetchedBeforeWriting == null
                ? Map.<UUID, AuthorResponse>of()
                : Map.of(comment.authorId(), AuthorResponse.named(profileFetchedBeforeWriting));
        var view = new CommentView(comment, Visibility.VISIBLE, List.of());
        return new CommentCreatedResponse(CommentResponse.from(view, authors), created.mutedByRecipient());
    }

    private Map<UUID, AuthorResponse> authorsOf(Set<UUID> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        var restricted = restrictions.findRestrictedAmong(ids, UserRestriction.CAPABILITY_COMMENT, Instant.now());
        // A restricted author's name is never sent, so it is not asked for either.
        var toName = ids.stream().filter(id -> !restricted.contains(id)).toList();
        var found = toName.isEmpty() ? Map.<UUID, AuthorProfile>of() : profiles.profiles(toName);

        var authors = new HashMap<UUID, AuthorResponse>(ids.size());
        for (var id : ids) {
            var profile = found.get(id);
            if (restricted.contains(id)) {
                authors.put(id, AuthorResponse.restricted(id));
            } else if (profile != null) {
                authors.put(id, AuthorResponse.named(profile));
            } else {
                log.warn("user-service has no profile for author {}", id);
            }
        }
        return authors;
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
