package com.tenniswire.user_service.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "display_name_reservation")
@Getter
@Setter
@NoArgsConstructor
public class DisplayNameReservation {

    @Id
    @Column(name = "name_lower", updatable = false)
    private String nameLower;

    @Column(name = "reserved_until", nullable = false)
    private Instant reservedUntil;
}
