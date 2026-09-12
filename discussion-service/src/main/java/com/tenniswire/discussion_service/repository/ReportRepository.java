package com.tenniswire.discussion_service.repository;

import com.tenniswire.discussion_service.entity.Report;
import com.tenniswire.discussion_service.entity.ReportResolution;
import java.util.Collection;
import java.util.List;
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

    long countByCommentIdAndResolvedAtIsNull(UUID commentId);

    @Modifying
    @Query("""
        update Report r
        set r.resolvedAt = current_timestamp,
            r.resolution = :resolution,
            r.resolvedBy = :resolvedBy,
            r.reporterHash = null
        where r.commentId = :commentId and r.resolvedAt is null
        """)
    int closeOpen(
            @Param("commentId") UUID commentId,
            @Param("resolution") ReportResolution resolution,
            @Param("resolvedBy") @Nullable UUID resolvedBy);
}
