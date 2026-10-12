package com.tenniswire.aggregator_service.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.Generated;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.generator.EventType;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "source")
@DynamicUpdate
@Getter
@Setter
@NoArgsConstructor
public class Source {

    // The collector's key: eurosport-fr, sports-ru
    @Id
    @Column(name = "key")
    private String key;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "language", nullable = false)
    private String language;

    @Column(name = "site_url", nullable = false)
    private String siteUrl;

    // Gone from the collector's list; its items live out their term
    @Column(name = "retired", nullable = false)
    private boolean retired;

    // The newsroom's (part 3): out of the feed, while the collector goes on
    @Column(name = "hidden", nullable = false)
    private boolean hidden;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "health")
    private HealthSnapshot health;

    @Column(name = "health_at")
    private Instant healthAt;

    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Generated(event = {EventType.INSERT, EventType.UPDATE})
    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
