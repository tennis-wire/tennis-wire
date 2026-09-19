package com.tenniswire.discussion_service.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.Generated;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.generator.EventType;

@Entity
@Table(name = "comment_reaction")
@DynamicUpdate
@Getter
@Setter
@NoArgsConstructor
public class CommentReaction {

    public static final String SLOT_VOTE = "vote";
    public static final String SLOT_EMOJI = "emoji";

    public static final String LIKE = "like";
    public static final String DISLIKE = "dislike";

    @Id
    @GeneratedValue
    @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    private UUID id;

    @Column(name = "comment_id", nullable = false, updatable = false)
    private UUID commentId;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(nullable = false, updatable = false)
    private String slot;

    @Column(nullable = false)
    private String value;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Generated(event = EventType.INSERT)
    private Instant createdAt;
}
