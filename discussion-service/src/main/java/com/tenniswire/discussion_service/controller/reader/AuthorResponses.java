package com.tenniswire.discussion_service.controller.reader;

import com.tenniswire.discussion_service.client.AuthorProfile;
import com.tenniswire.discussion_service.client.AuthorProfileClient;
import com.tenniswire.discussion_service.dto.reader.AuthorResponse;
import com.tenniswire.discussion_service.dto.reader.AuthorResponse.Named;
import com.tenniswire.discussion_service.entity.UserRestriction;
import com.tenniswire.discussion_service.repository.UserRestrictionRepository;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

// How a person is shown to a reader, under a comment or in his own ignore list: a name, the
// restriction label instead of it, or nothing where user-service has no profile.
@Component
@Slf4j
public class AuthorResponses {

    private final AuthorProfileClient profiles;
    private final UserRestrictionRepository restrictions;

    public AuthorResponses(AuthorProfileClient profiles, UserRestrictionRepository restrictions) {
        this.profiles = profiles;
        this.restrictions = restrictions;
    }

    // Whatever restriction stands: for a caller that must know the person exists before writing,
    // not for a name to show
    public @Nullable AuthorProfile profile(UUID id) {
        return profiles.profiles(List.of(id)).get(id);
    }

    public Map<UUID, AuthorResponse> of(Set<UUID> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        var restricted = restrictions.findRestrictedAmong(ids, UserRestriction.CAPABILITY_COMMENT, Instant.now());
        // A restricted name is never sent, so it is not asked for either.
        var toName = ids.stream().filter(id -> !restricted.contains(id)).toList();
        var found = toName.isEmpty() ? Map.<UUID, AuthorProfile>of() : profiles.profiles(toName);

        var people = new HashMap<UUID, AuthorResponse>(ids.size());
        for (var id : ids) {
            var profile = found.get(id);
            if (restricted.contains(id)) {
                people.put(id, AuthorResponse.restricted(id));
            } else if (profile != null) {
                people.put(id, AuthorResponse.named(profile));
            } else {
                log.warn("user-service has no profile for user {}", id);
            }
        }
        return people;
    }

    // One person for his own page: null under a restriction and for an id nobody has alike. No
    // warning for the second, unlike a batch of authors: here anyone can ask about any id.
    public @Nullable Named named(UUID id) {
        var restricted =
                restrictions.findRestrictedAmong(Set.of(id), UserRestriction.CAPABILITY_COMMENT, Instant.now());
        if (restricted.contains(id)) {
            return null;
        }
        var profile = profiles.profiles(List.of(id)).get(id);
        return profile == null ? null : new Named(profile.id(), profile.displayName(), profile.avatarUrl());
    }

    // A profile already in hand from before a write. The restriction is still looked up, but that
    // one is local: nothing after the write can fail on user-service's account.
    public AuthorResponse of(AuthorProfile profile) {
        var restricted = restrictions.findRestrictedAmong(
                Set.of(profile.id()), UserRestriction.CAPABILITY_COMMENT, Instant.now());
        return restricted.contains(profile.id())
                ? AuthorResponse.restricted(profile.id())
                : AuthorResponse.named(profile);
    }
}
