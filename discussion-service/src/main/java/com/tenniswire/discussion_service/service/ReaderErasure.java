package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.entity.UserRestriction;
import com.tenniswire.discussion_service.repository.CommentRepository;
import com.tenniswire.discussion_service.repository.UserRestrictionRepository;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class ReaderErasure {

    public static final int BATCH_SIZE = 250;

    private final CommentRepository comments;
    private final UserRestrictionRepository restrictions;
    private final ErasedReaderWriter writer;

    public ReaderErasure(
            CommentRepository comments, UserRestrictionRepository restrictions, ErasedReaderWriter writer) {
        this.comments = comments;
        this.restrictions = restrictions;
        this.writer = writer;
    }

    public ErasedReader erase(UUID readerId) {
        var now = Instant.now();
        // Read first, and deliberately not deleted below: this is what tells user-service the
        // address stays taken until the ban runs out, and a repeated call has to say the same.
        var ban = restrictions.findActive(readerId, UserRestriction.CAPABILITY_COMMENT, now).stream()
                .findFirst()
                .orElse(null);

        var his = comments.findIdsByAuthor(readerId);
        for (var from = 0; from < his.size(); from += BATCH_SIZE) {
            writer.erase(his.subList(from, Math.min(from + BATCH_SIZE, his.size())));
        }
        writer.eraseTheRest(readerId, now);

        return new ErasedReader(ban != null, ban == null ? null : ban.expiresAt());
    }
}
