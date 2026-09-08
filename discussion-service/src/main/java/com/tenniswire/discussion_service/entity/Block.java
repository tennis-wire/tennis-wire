package com.tenniswire.discussion_service.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

/** blocker does not want to see blocked. One direction, no notification, render-time only. */
@Entity
@Table(name = "block")
@Getter
@Setter
@NoArgsConstructor
public class Block {

    @EmbeddedId
    private BlockId id;

    @Column(name = "mode", nullable = false, columnDefinition = "block_mode")
    private BlockMode mode;

    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    public Block(BlockId id, BlockMode mode) {
        this.id = id;
        this.mode = mode;
    }
}
