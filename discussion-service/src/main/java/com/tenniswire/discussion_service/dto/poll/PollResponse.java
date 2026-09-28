package com.tenniswire.discussion_service.dto.poll;

import com.tenniswire.discussion_service.entity.Poll;
import com.tenniswire.discussion_service.entity.PollOption;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

// Counts for everyone, and the viewer's own choice where there is a viewer. Nobody else's.
// voteCount is the number of people who voted; in a multiple-choice poll the options add up to more.
public record PollResponse(
        UUID id,
        String question,
        @Nullable Instant closesAt,
        boolean closed,
        boolean multipleChoice,
        int voteCount,
        List<Option> options,
        List<UUID> viewerOptionIds) {

    public record Option(UUID id, String text, int voteCount) {

        static Option from(PollOption option) {
            return new Option(option.id(), option.text(), option.voteCount());
        }
    }

    // The viewer's choice comes back in the order the options stand in
    public static PollResponse from(Poll poll, List<UUID> viewerOptionIds, Instant now) {
        var options = poll.options().stream().map(Option::from).toList();
        return new PollResponse(
                poll.id(),
                poll.question(),
                poll.closesAt(),
                poll.isClosed(now),
                poll.multipleChoice(),
                poll.voteCount(),
                options,
                options.stream()
                        .map(Option::id)
                        .filter(viewerOptionIds::contains)
                        .toList());
    }
}
