package com.tenniswire.user_service.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

@Entity
@Table(name = "identity_link")
@Getter
@Setter
@NoArgsConstructor
public class IdentityLink {

    // The only provider there is: Google and Apple are brokered inside Keycloak and never reach
    // this table under their own names. The column exists for the day that stops being true.
    public static final String KEYCLOAK = "keycloak";

    @EmbeddedId
    private IdentityLinkId id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    public IdentityLink(IdentityLinkId id, UUID userId) {
        this.id = id;
        this.userId = userId;
    }
}
