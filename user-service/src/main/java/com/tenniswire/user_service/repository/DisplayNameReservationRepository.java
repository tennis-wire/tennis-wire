package com.tenniswire.user_service.repository;

import com.tenniswire.user_service.entity.DisplayNameReservation;
import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface DisplayNameReservationRepository extends JpaRepository<DisplayNameReservation, String> {

    // Upserted rather than inserted: a name can come round again, and the later date is the one
    // that matters. Native, because lowering the name is the database's job here as it is in the
    // unique index and in the trigger - one notion of the same name, in one place.
    @Modifying
    @Query(value = """
            insert into display_name_reservation (name_lower, reserved_until)
            values (lower(:name), :until)
            on conflict (name_lower)
            do update set reserved_until = greatest(display_name_reservation.reserved_until, excluded.reserved_until)
            """, nativeQuery = true)
    int hold(@Param("name") String name, @Param("until") Instant until);

    // Swept rather than left to accumulate: a name nobody may take is one thing, a list of names
    // people once used, kept for ever, is another.
    @Transactional
    @Modifying
    @Query("delete from DisplayNameReservation r where r.reservedUntil <= :now")
    int release(@Param("now") Instant now);
}
