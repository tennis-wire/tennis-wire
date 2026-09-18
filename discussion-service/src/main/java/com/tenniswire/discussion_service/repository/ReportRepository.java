package com.tenniswire.discussion_service.repository;

import com.tenniswire.discussion_service.entity.Report;
import com.tenniswire.discussion_service.entity.ReportResolution;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReportRepository extends JpaRepository<Report, UUID> {

    @Modifying
    @Query(value = """
            insert into report (comment_id, reporter_hash, source, reason)
            values (:commentId, :reporterHash, 'user', :reason)
            on conflict do nothing
            """, nativeQuery = true)
    int insertReaderReport(
            @Param("commentId") UUID commentId,
            @Param("reporterHash") byte[] reporterHash,
            @Param("reason") String reason);

    // The same conflict handling for the classifier, which carries no hash: the partial unique
    // index keeps it to one open report per comment until that one is decided
    @Modifying
    @Query(value = """
            insert into report (comment_id, source, reason)
            values (:commentId, 'bot', :reason)
            on conflict do nothing
            """, nativeQuery = true)
    int insertBotReport(@Param("commentId") UUID commentId, @Param("reason") String reason);

    // The queue's backbone: one row per comment with open reports, heaviest first and, at equal
    // weight, whoever has been waiting longest. Paged here rather than by cursor - the sort key is
    // a count that changes under the reader, and a cursor over it would skip and repeat entries.
    @Query("""
        select new com.tenniswire.discussion_service.repository.OpenReportGroup(
            r.commentId, count(r), min(r.createdAt), max(r.createdAt))
        from Report r
        where r.resolvedAt is null
        group by r.commentId
        order by count(r) desc, min(r.createdAt) asc
        """)
    List<OpenReportGroup> findOpenGroups(Pageable page);

    // The breakdown behind one page of the queue: which reasons, and whether the bot is among them
    @Query("""
        select new com.tenniswire.discussion_service.repository.ReasonTally(
            r.commentId, r.reason, r.source, count(r))
        from Report r
        where r.resolvedAt is null and r.commentId in :commentIds
        group by r.commentId, r.reason, r.source
        """)
    List<ReasonTally> findOpenTallies(@Param("commentIds") Collection<UUID> commentIds);

    // Run by an edit, before the new text replaces the old one. Reports filed after it start at null
    // again and are left alone here, which is why the card reads the earliest open report and not
    // any of them: that one carries the text the complaint was actually about.
    @Modifying
    @Query("""
        update Report r
        set r.bodyAtReport = :body
        where r.commentId = :commentId and r.resolvedAt is null and r.bodyAtReport is null
        """)
    int snapshotOpen(@Param("commentId") UUID commentId, @Param("body") String body);

    // Null bodies come back too: the caller cannot tell a comment nobody edited from one the query
    // skipped, and the first means "the text is the one on the comment".
    @Query("""
        select new com.tenniswire.discussion_service.repository.ReportedBody(r.commentId, r.bodyAtReport)
        from Report r
        where r.commentId in :commentIds
          and r.resolvedAt is null
          and r.createdAt = (
              select min(r2.createdAt) from Report r2
              where r2.commentId = r.commentId and r2.resolvedAt is null)
        """)
    List<ReportedBody> findBodyAtFirstOpenReport(@Param("commentIds") Collection<UUID> commentIds);

    long countByCommentIdAndResolvedAtIsNull(UUID commentId);

    // Which of these comments carry a report at all, decided or not. Such a comment is never taken
    // away outright when its author deletes it: the queue keeps the card with a "deleted by its
    // author" mark, and the decided rows are the moderation journal, which the comment_id foreign
    // key would cascade away with the comment.
    @Query("select distinct r.commentId from Report r where r.commentId in :commentIds")
    Set<UUID> findReportedAmong(@Param("commentIds") Collection<UUID> commentIds);

    // Closes every open report on a comment at once and erases the hashes with them: once a
    // decision is taken there is nothing left to deduplicate, and the reporter was only ever kept
    // for that. The snapshot goes the same way: it existed to be read on this card.
    // The timestamp comes from the database so that one decision carries one time
    @Modifying
    @Query("""
        update Report r
        set r.resolvedAt = current_timestamp,
            r.resolution = :resolution,
            r.resolvedBy = :resolvedBy,
            r.reporterHash = null,
            r.bodyAtReport = null
        where r.commentId = :commentId and r.resolvedAt is null
        """)
    int closeOpen(
            @Param("commentId") UUID commentId,
            @Param("resolution") ReportResolution resolution,
            @Param("resolvedBy") @Nullable UUID resolvedBy);

    // The batch twin of closeOpen, for what the service closes on its own: a whole reader's worth of
    // comments on an erase, a batch of texts past their term on the wipe. Nobody decided these, so
    // there is no resolvedBy to record. By the time an erase runs it, the comments nothing stood on
    // are gone and their reports with them; what it closes is what survived.
    @Modifying
    @Query("""
        update Report r
        set r.resolvedAt = current_timestamp,
            r.resolution = :resolution,
            r.resolvedBy = null,
            r.reporterHash = null,
            r.bodyAtReport = null
        where r.commentId in :commentIds and r.resolvedAt is null
        """)
    int closeOpenOn(@Param("commentIds") Collection<UUID> commentIds, @Param("resolution") ReportResolution resolution);
}
