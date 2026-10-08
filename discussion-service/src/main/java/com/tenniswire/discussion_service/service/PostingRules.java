package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.config.PostingProperties;
import com.tenniswire.discussion_service.exception.DuplicateCommentException;
import com.tenniswire.discussion_service.exception.LinksNotYetException;
import com.tenniswire.discussion_service.exception.PostingTooFastException;
import com.tenniswire.discussion_service.exception.TooManyLinksException;
import com.tenniswire.discussion_service.repository.CommentRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

/**
 * What a person never runs into and a script does: a pace between comments and a ceiling an hour,
 * links held back from a newcomer, and the same text not taken twice. A newcomer is an author with
 * fewer than a few comments that have stood for a day; the numbers are configuration.
 */
@Component
class PostingRules {

    private static final Duration HOUR = Duration.ofHours(1);

    // What the site and the app draw as a link, so the server counts no fewer than the reader sees
    private static final Pattern LINK = Pattern.compile("https?://[^\\s<>\"']+", Pattern.UNICODE_CHARACTER_CLASS);
    private static final Pattern SPACES = Pattern.compile("\\s+", Pattern.UNICODE_CHARACTER_CLASS);

    private final CommentRepository comments;
    private final PostingProperties rules;

    PostingRules(CommentRepository comments, PostingProperties rules) {
        this.comments = comments;
        this.rules = rules;
    }

    boolean isNewcomer(UUID authorId) {
        var enough = rules.newcomer().standingComments();
        if (enough <= 0) {
            return false;
        }
        var before = Instant.now().minus(rules.newcomer().standingFor());
        return comments.countStandingBefore(authorId, before, enough) < enough;
    }

    void assertLinks(boolean newcomer, String body) {
        var links = LINK.matcher(body).results().count();
        if (links == 0) {
            return;
        }
        if (newcomer) {
            throw new LinksNotYetException();
        }
        if (links > rules.maxLinks()) {
            throw new TooManyLinksException(rules.maxLinks());
        }
    }

    /**
     * Holds the author's posting lock to the commit, so the comment about to be written is what his
     * next send finds. Taken before any tree lock.
     */
    void holdPace(UUID authorId, boolean newcomer) {
        comments.lockAuthorPosting(authorId.hashCode());
        var now = Instant.now();
        var last = comments.findLastStandingCreatedAt(authorId);
        if (last != null) {
            var next = last.plus(newcomer ? rules.newcomer().interval() : rules.interval());
            if (next.isAfter(now)) {
                throw new PostingTooFastException(Duration.between(now, next));
            }
        }
        var hourAgo = now.minus(HOUR);
        if (comments.countStandingSince(authorId, hourAgo) >= rules.hourlyCeiling()) {
            var first = comments.findFirstStandingCreatedAtSince(authorId, hourAgo);
            // the hour frees a place when its earliest comment leaves it
            var freed = first == null ? now : first.plus(HOUR);
            throw new PostingTooFastException(Duration.between(now, freed));
        }
    }

    /**
     * In the same discussion a text is not taken twice at all; elsewhere, not within a short while,
     * which is how a mailing looks. Short texts are left alone: in a live match "Break!" comes
     * again and means it. {@code editing} is the comment being changed, not to be held against itself.
     */
    void assertNotRepeated(UUID authorId, String body, String subjectType, UUID subjectId, @Nullable UUID editing) {
        var text = normalized(body);
        if (text.length() < rules.duplicate().minLength()) {
            return;
        }
        var since = Instant.now().minus(rules.duplicate().elsewhereWithin());
        var repeated = comments.findTextsToCompare(authorId, subjectType, subjectId, since).stream()
                .filter(earlier -> !earlier.id().equals(editing))
                .anyMatch(earlier -> normalized(earlier.body()).equals(text));
        if (repeated) {
            throw new DuplicateCommentException();
        }
    }

    // Case and spacing do not make a text new
    private static String normalized(String body) {
        return SPACES.matcher(body.strip()).replaceAll(" ").toLowerCase(Locale.ROOT);
    }
}
