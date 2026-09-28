package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.dto.poll.CreatePollRequest;
import com.tenniswire.discussion_service.dto.poll.PollResponse;
import com.tenniswire.discussion_service.dto.poll.UpdatePollRequest;
import com.tenniswire.discussion_service.entity.Poll;
import com.tenniswire.discussion_service.entity.PollOption;
import com.tenniswire.discussion_service.entity.PollVote;
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
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// One choice per person per poll, replaceable and removable while the poll is open: a single option,
// or any number of them in a multiple-choice poll. The counts on the poll and its options are what a
// reader sees, the poll's counting people and an option's the people who chose it. The vote rows
// exist for the one-choice-per-person rule, for marking the viewer's own choice, and for taking his
// votes off when his account goes.
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
                .closesAt(request.closesAt())
                .multipleChoice(Boolean.TRUE.equals(request.multipleChoice()));
        polls.save(poll);
        for (var i = 0; i < request.options().size(); i++) {
            var option = new PollOption()
                    .poll(poll)
                    .position((short) i)
                    .text(request.options().get(i).strip());
            poll.options().add(options.save(option));
        }
        return PollResponse.from(poll, List.of(), Instant.now());
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
        return PollResponse.from(poll, List.of(), Instant.now());
    }

    public PollResponse close(UUID pollId, PollEditor editor, @Nullable Instant closesAt) {
        var poll = editable(pollId, editor);
        poll.closesAt(closesAt);
        return PollResponse.from(poll, List.of(), Instant.now());
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
        List<UUID> mine = viewerId == null
                ? List.of()
                : votes.findChoice(pollId, viewerId).stream()
                        .map(PollVote::optionId)
                        .toList();
        return PollResponse.from(poll, mine, Instant.now());
    }

    // A vote is a reaction in every way that matters here, so a ban stops it the same way and lets
    // it be taken back
    public void vote(UUID actorId, UUID pollId, List<UUID> optionIds) {
        var ban = restrictions.findActive(actorId, UserRestriction.CAPABILITY_COMMENT, Instant.now());
        if (!ban.isEmpty()) {
            throw new CommentingRestrictedException(ban.getFirst().expiresAt());
        }
        var poll = lockAndLoad(pollId);
        if (poll.isClosed(Instant.now())) {
            throw new PollClosedException(pollId);
        }
        var wanted = new LinkedHashSet<>(optionIds);
        if (!poll.multipleChoice() && wanted.size() != 1) {
            throw new IllegalArgumentException("A single-choice poll takes exactly one option");
        }
        var known = poll.options().stream().map(PollOption::id).collect(Collectors.toSet());
        for (var optionId : wanted) {
            if (!known.contains(optionId)) {
                throw new ResourceNotFoundException("Poll option", optionId);
            }
        }

        // Only the difference moves: an option chosen before and now keeps its row and its count
        var held = votes.findChoice(pollId, actorId);
        if (held.isEmpty()) {
            poll.voteCount(poll.voteCount() + 1);
        }
        var kept = new HashSet<UUID>();
        for (var vote : held) {
            if (wanted.contains(vote.optionId())) {
                kept.add(vote.optionId());
            } else {
                shift(poll, vote.optionId(), -1);
                votes.delete(vote);
            }
        }
        for (var optionId : wanted) {
            if (!kept.contains(optionId)) {
                votes.save(new PollVote().pollId(pollId).userId(actorId).optionId(optionId));
                shift(poll, optionId, 1);
            }
        }
    }

    public void retract(UUID actorId, UUID pollId) {
        if (polls.lockCounters(pollId).isEmpty()) {
            return;
        }
        var poll = polls.findById(pollId).orElse(null);
        var held = votes.findChoice(pollId, actorId);
        if (poll == null || held.isEmpty()) {
            return;
        }
        if (poll.isClosed(Instant.now())) {
            throw new PollClosedException(pollId);
        }
        held.forEach(vote -> shift(poll, vote.optionId(), -1));
        poll.voteCount(Math.max(poll.voteCount() - 1, 0));
        votes.deleteAll(held);
    }

    // Every vote one person cast, taken off the counts with the rows. Closed polls included: a
    // count that stands for someone who is gone is not a count anyone asked to keep.
    public int clearAllBy(UUID userId) {
        var mine = votes.findByUser(userId);
        var byPoll =
                mine.stream().collect(Collectors.groupingBy(PollVote::pollId, LinkedHashMap::new, Collectors.toList()));
        byPoll.forEach((pollId, choice) -> {
            if (polls.lockCounters(pollId).isEmpty()) {
                return;
            }
            polls.findById(pollId).ifPresent(poll -> {
                choice.forEach(vote -> shift(poll, vote.optionId(), -1));
                poll.voteCount(Math.max(poll.voteCount() - 1, 0));
            });
        });
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
