package com.tenniswire.discussion_service.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "author_reaction_total")
@DynamicUpdate
@Getter
@Setter
@NoArgsConstructor
public class AuthorReactionTotal {

    @Id
    @Column(name = "author_id", nullable = false, updatable = false)
    private UUID authorId;

    @Column(name = "like_count", nullable = false)
    private long likeCount;

    @Column(name = "dislike_count", nullable = false)
    private long dislikeCount;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "emoji_counts", nullable = false)
    private Map<String, Long> emojiCounts = new HashMap<>();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
