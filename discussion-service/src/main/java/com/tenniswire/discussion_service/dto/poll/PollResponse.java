package com.tenniswire.discussion_service.dto.poll;

import com.tenniswire.discussion_service.entity.Poll;
import com.tenniswire.discussion_service.entity.PollOption;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

// Counts for everyone, and the viewer's own choice where there is a viewer. Nobody else's.
public record PollResponse(
        UUID id,
        String question,
        @Nullable Instant closesAt,
        boolean closed,
        int voteCount,
        List<Option> options,
        @Nullable UUID viewerOptionId) {

    public record Option(UUID id, String text, int voteCount) {

        static Option from(PollOption option) {
            return new Option(option.id(), option.text(), option.voteCount());
        }
    }

    public static PollResponse from(Poll poll, @Nullable UUID viewerOptionId, Instant now) {
        return new PollResponse(
                poll.id(),
                poll.question(),
                poll.closesAt(),
                poll.isClosed(now),
                poll.voteCount(),
                poll.options().stream().map(Option::from).toList(),
                viewerOptionId);
    }
}
