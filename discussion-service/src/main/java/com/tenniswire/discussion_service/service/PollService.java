package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.dto.poll.CreatePollRequest;
import com.tenniswire.discussion_service.dto.poll.PollResponse;
import com.tenniswire.discussion_service.dto.poll.UpdatePollRequest;
import com.tenniswire.discussion_service.entity.Poll;
import com.tenniswire.discussion_service.entity.PollOption;
import com.tenniswire.discussion_service.entity.PollVote;
import com.tenniswire.discussion_service.entity.PollVoteId;
import com.tenniswire.discussion_service.entity.UserRestriction;
import com.tenniswire.discussion_service.exception.CommentingRestrictedException;
import com.tenniswire.discussion_service.exception.ForbiddenException;
import com.tenniswire.discussion_service.exception.PollClosedException;
import com.tenniswire.discussion_service.exception.ResourceNotFoundException;
import com.tenniswire.discussion_service.repository.PollOptionRepository;
import com.tenniswire.discussion_service.repository.PollRepository;
import com.tenniswire.discussion_service.repository.PollVoteRepository;
import com.tenniswire.discussion_service.repository.UserRestrictionRepository;
import java.time.Instant;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// One vote per person per poll, replaceable and removable while the poll is open. The counts on
// the poll and its options are what a reader sees; the vote rows exist for the one-per-person rule,
// for marking the viewer's own choice, and for taking his votes off when his account goes.
@Service
@Transactional
public class PollService {

    private final PollRepository polls;
    private final PollOptionRepository options;
    private final PollVoteRepository votes;
    private final UserRestrictionRepository restrictions;

    public PollService(
            PollRepository polls,
            PollOptionRepository options,
            PollVoteRepository votes,
            UserRestrictionRepository restrictions) {
        this.polls = polls;
        this.options = options;
        this.votes = votes;
        this.restrictions = restrictions;
    }

    public PollResponse create(UUID createdBy, CreatePollRequest request) {
        var poll = new Poll()
                .question(request.question().strip())
                .createdBy(createdBy)
                .closesAt(request.closesAt());
        polls.save(poll);
        for (var i = 0; i < request.options().size(); i++) {
            var option = new PollOption()
                    .poll(poll)
                    .position((short) i)
                    .text(request.options().get(i).strip());
            poll.options().add(options.save(option));
        }
        return PollResponse.from(poll, null, Instant.now());
    }

    public PollResponse update(UUID pollId, PollEditor editor, UpdatePollRequest request) {
        var poll = editable(pollId, editor);
        var question = request.question();
        if (question != null) {
            poll.question(question.strip());
        }
        var changes = request.options();
        if (changes != null) {
            var byId = poll.options().stream().collect(Collectors.toMap(PollOption::id, Function.identity()));
            for (var change : changes) {
                var option = byId.get(change.id());
                if (option == null) {
                    throw new ResourceNotFoundException("Poll option", change.id());
                }
                option.text(change.text().strip());
            }
        }
        return PollResponse.from(poll, null, Instant.now());
    }

    public PollResponse close(UUID pollId, PollEditor editor, @Nullable Instant closesAt) {
        var poll = editable(pollId, editor);
        poll.closesAt(closesAt);
        return PollResponse.from(poll, null, Instant.now());
    }

    // Its author's to change, as his article is, and anyone's for a chief editor
    private Poll editable(UUID pollId, PollEditor editor) {
        var poll = polls.findById(pollId).orElseThrow(() -> new ResourceNotFoundException("Poll", pollId));
        if (!editor.chiefEditor() && !poll.createdBy().equals(editor.subject())) {
            throw new ForbiddenException("Only its author or a chief editor may change a poll");
        }
        return poll;
    }

    @Transactional(readOnly = true)
    public PollResponse get(UUID pollId, @Nullable UUID viewerId) {
        var poll = polls.findById(pollId).orElseThrow(() -> new ResourceNotFoundException("Poll", pollId));
        var mine = viewerId == null
                ? null
                : votes.findById(new PollVoteId(pollId, viewerId))
                        .map(PollVote::optionId)
                        .orElse(null);
        return PollResponse.from(poll, mine, Instant.now());
    }

    // A vote is a reaction in every way that matters here, so a ban stops it the same way and lets
    // it be taken back
    public void vote(UUID actorId, UUID pollId, UUID optionId) {
        var ban = restrictions.findActive(actorId, UserRestriction.CAPABILITY_COMMENT, Instant.now());
        if (!ban.isEmpty()) {
            throw new CommentingRestrictedException(ban.getFirst().expiresAt());
        }
        var poll = lockAndLoad(pollId);
        if (poll.isClosed(Instant.now())) {
            throw new PollClosedException(pollId);
        }
        var chosen = poll.options().stream()
                .filter(option -> option.id().equals(optionId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Poll option", optionId));

        var existing = votes.findById(new PollVoteId(pollId, actorId)).orElse(null);
        if (existing == null) {
            votes.save(new PollVote().pollId(pollId).userId(actorId).optionId(optionId));
            chosen.voteCount(chosen.voteCount() + 1);
            poll.voteCount(poll.voteCount() + 1);
            return;
        }
        if (existing.optionId().equals(optionId)) {
            return;
        }
        shift(poll, existing.optionId(), -1);
        existing.optionId(optionId);
        chosen.voteCount(chosen.voteCount() + 1);
    }

    public void retract(UUID actorId, UUID pollId) {
        if (polls.lockCounters(pollId).isEmpty()) {
            return;
        }
        var poll = polls.findById(pollId).orElse(null);
        var existing = votes.findById(new PollVoteId(pollId, actorId)).orElse(null);
        if (poll == null || existing == null) {
            return;
        }
        if (poll.isClosed(Instant.now())) {
            throw new PollClosedException(pollId);
        }
        shift(poll, existing.optionId(), -1);
        poll.voteCount(Math.max(poll.voteCount() - 1, 0));
        votes.delete(existing);
    }

    // Every vote one person cast, taken off the counts with the rows. Closed polls included: a
    // count that stands for someone who is gone is not a count anyone asked to keep.
    public int clearAllBy(UUID userId) {
        var mine = votes.findByUser(userId);
        for (var vote : mine) {
            if (polls.lockCounters(vote.pollId()).isEmpty()) {
                continue;
            }
            polls.findById(vote.pollId()).ifPresent(poll -> {
                shift(poll, vote.optionId(), -1);
                poll.voteCount(Math.max(poll.voteCount() - 1, 0));
            });
        }
        votes.deleteAll(mine);
        return mine.size();
    }

    private Poll lockAndLoad(UUID pollId) {
        polls.lockCounters(pollId).orElseThrow(() -> new ResourceNotFoundException("Poll", pollId));
        return polls.findById(pollId).orElseThrow(() -> new ResourceNotFoundException("Poll", pollId));
    }

    private static void shift(Poll poll, UUID optionId, int delta) {
        poll.options().stream()
                .filter(option -> option.id().equals(optionId))
                .findFirst()
                .ifPresent(option -> option.voteCount(Math.max(option.voteCount() + delta, 0)));
    }
}
