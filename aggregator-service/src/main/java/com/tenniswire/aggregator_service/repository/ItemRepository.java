package com.tenniswire.aggregator_service.repository;

import com.tenniswire.aggregator_service.entity.Item;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

public interface ItemRepository extends JpaRepository<Item, UUID> {

    Optional<Item> findByUrl(String url);

    // One expiry pass at a time across instances; 1 is this lock's name in this database. Held until
    // the transaction ends.
    @Transactional(propagation = Propagation.MANDATORY)
    @Query(value = "select pg_try_advisory_xact_lock(1, 0)", nativeQuery = true)
    boolean tryLockExpiry();

    @Modifying
    @Query(
            value = "delete from item where id in "
                    + "(select id from item where created_at < :cutoff order by created_at limit :size)",
            nativeQuery = true)
    int deleteArrivedBefore(@Param("cutoff") Instant cutoff, @Param("size") int size);
}
