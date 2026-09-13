package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.entity.ReportResolution;
import com.tenniswire.discussion_service.entity.UserRestriction;
import com.tenniswire.discussion_service.repository.BlockRepository;
import com.tenniswire.discussion_service.repository.CommentRepository;
import com.tenniswire.discussion_service.repository.ReportRepository;
import com.tenniswire.discussion_service.repository.UserRestrictionRepository;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ReaderErasure {

    private final CommentRepository comments;
    private final CommentCollapse collapse;
    private final ReportRepository reports;
    private final BlockRepository blocks;
    private final UserRestrictionRepository restrictions;

    public ReaderErasure(
            CommentRepository comments,
            CommentCollapse collapse,
            ReportRepository reports,
            BlockRepository blocks,
            UserRestrictionRepository restrictions) {
        this.comments = comments;
        this.collapse = collapse;
        this.reports = reports;
        this.blocks = blocks;
        this.restrictions = restrictions;
    }

    public ErasedReader erase(UUID readerId) {
        var now = Instant.now();
        // Read first, and deliberately not deleted below: this is what tells user-service the
        // address stays taken until the ban runs out, and a repeated call has to say the same.
        var ban = restrictions.findActive(readerId, UserRestriction.CAPABILITY_COMMENT, now).stream()
                .findFirst()
                .orElse(null);

        var his = comments.findIdsByAuthor(readerId);
        if (!his.isEmpty()) {
            comments.anonymize(his);
            // read back: anonymize wrote around the entities and cleared the context behind it
            collapse.of(comments.findAllById(his));
            reports.closeOpenOn(his, ReportResolution.VOIDED);
        }
        blocks.deleteInvolving(readerId);
        restrictions.deleteExpiredFor(readerId, now);

        return new ErasedReader(ban != null, ban == null ? null : ban.expiresAt());
    }
}
