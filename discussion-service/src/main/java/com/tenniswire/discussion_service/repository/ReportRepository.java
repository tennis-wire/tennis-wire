package com.tenniswire.discussion_service.repository;

import com.tenniswire.discussion_service.entity.Report;
import java.util.UUID;
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
}
