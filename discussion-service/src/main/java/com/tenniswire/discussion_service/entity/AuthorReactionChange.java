package com.tenniswire.discussion_service.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "author_reaction_change")
@Getter
@Setter
@NoArgsConstructor
public class AuthorReactionChange {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "author_id", nullable = false, updatable = false)
    private UUID authorId;

    @Column(nullable = false, updatable = false)
    private String slot;

    @Column(nullable = false, updatable = false)
    private String value;

    @Column(nullable = false, updatable = false)
    private int delta;
}
