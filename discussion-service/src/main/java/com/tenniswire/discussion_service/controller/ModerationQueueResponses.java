package com.tenniswire.discussion_service.controller;

import com.tenniswire.discussion_service.client.AuthorProfile;
import com.tenniswire.discussion_service.client.AuthorProfileClient;
import com.tenniswire.discussion_service.dto.ModerationQueueResponse;
import com.tenniswire.discussion_service.dto.QueueEntryResponse;
import com.tenniswire.discussion_service.dto.QueueEntryResponse.ActiveRestriction;
import com.tenniswire.discussion_service.dto.QueueEntryResponse.QueueAuthor;
import com.tenniswire.discussion_service.dto.QueueEntryResponse.RemovalCounts;
import com.tenniswire.discussion_service.entity.Comment;
import com.tenniswire.discussion_service.entity.UserRestriction;
import com.tenniswire.discussion_service.exception.UserServiceUnavailableException;
import com.tenniswire.discussion_service.repository.CommentRepository;
import com.tenniswire.discussion_service.repository.UserRestrictionRepository;
import com.tenniswire.discussion_service.service.QueuedComment;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class ModerationQueueResponses {

    private static final Duration RECENT = Duration.ofDays(30);

    private final AuthorProfileClient profiles;
    private final UserRestrictionRepository restrictions;
    private final CommentRepository comments;

    public ModerationQueueResponses(
            AuthorProfileClient profiles, UserRestrictionRepository restrictions, CommentRepository comments) {
        this.profiles = profiles;
        this.restrictions = restrictions;
        this.comments = comments;
    }

    public ModerationQueueResponse of(List<QueuedComment> queued, int page, int size) {
        var authorIds = queued.stream().map(q -> q.comment().authorId()).collect(Collectors.toSet());
        var named = namesOf(authorIds);
        var banned = bansOf(authorIds);
        var removed = removalsOf(authorIds);

        var items =
                queued.stream().map(card -> entry(card, named, banned, removed)).toList();
        return new ModerationQueueResponse(items, page, size);
    }

    private static QueueEntryResponse entry(
            QueuedComment card,
            Map<UUID, AuthorProfile> named,
            Map<UUID, UserRestriction> banned,
            Map<UUID, Map<String, RemovalCounts>> removed) {

        var comment = card.comment();
        var authorId = comment.authorId();
        var profile = named.get(authorId);
        var ban = banned.get(authorId);
        var record = removed.getOrDefault(authorId, Map.of());

        var author = new QueueAuthor(
                authorId,
                profile == null ? null : profile.displayName(),
                profile == null ? null : profile.avatarUrl(),
                ban == null ? null : new ActiveRestriction(ban.expiresAt()),
                record.getOrDefault(Comment.HIDDEN_BY_MODERATOR, RemovalCounts.NONE),
                record.getOrDefault(Comment.HIDDEN_BY_BOT, RemovalCounts.NONE));

        return new QueueEntryResponse(
                comment.id(),
                comment.subjectType(),
                comment.subjectId(),
                comment.rootId(),
                comment.body(),
                comment.isDeleted() && !comment.isHiddenByModeration(),
                author,
                card.reportCount(),
                card.reasons(),
                card.fromBot(),
                card.firstReportedAt(),
                card.lastReportedAt());
    }

    private Map<UUID, AuthorProfile> namesOf(Set<UUID> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        try {
            return profiles.profiles(ids);
        } catch (UserServiceUnavailableException e) {
            // Not a 503. The queue is what a moderator reaches for when something is going wrong,
            // and a card is still actionable without a name on it: the text, the reasons and the
            // decision are all here.
            log.warn("user-service is unavailable; serving the moderation queue without author names");
            return Map.of();
        }
    }

    private Map<UUID, UserRestriction> bansOf(Set<UUID> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        // Ordered indefinite-first, then latest expiry, so the first row for a user is the binding one.
        return restrictions.findActiveAmong(ids, UserRestriction.CAPABILITY_COMMENT, Instant.now()).stream()
                .collect(Collectors.toMap(UserRestriction::userId, r -> r, (first, later) -> first));
    }

    private Map<UUID, Map<String, RemovalCounts>> removalsOf(Set<UUID> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        var byAuthor = new HashMap<UUID, Map<String, RemovalCounts>>();
        for (var tally : comments.countRemovalsAmong(ids, Instant.now().minus(RECENT))) {
            byAuthor.computeIfAbsent(tally.authorId(), id -> new HashMap<>())
                    .put(tally.hiddenSource(), new RemovalCounts(tally.recent(), tally.total()));
        }
        return byAuthor;
    }
}
