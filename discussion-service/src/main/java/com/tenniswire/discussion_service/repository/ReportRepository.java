package com.tenniswire.discussion_service.repository;

import com.tenniswire.discussion_service.entity.Report;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReportRepository extends JpaRepository<Report, UUID> {}
