package com.tenniswire.aggregator_service.repository;

import com.tenniswire.aggregator_service.entity.Source;
import java.util.Collection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SourceRepository extends JpaRepository<Source, String> {

    @Modifying
    @Query("update Source s set s.retired = true where s.retired = false and s.key not in :keys")
    int retireAllBut(@Param("keys") Collection<String> keys);
}
