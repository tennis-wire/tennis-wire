package com.tenniswire.discussion_service.dto.moderation;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

// expiresAt null means indefinite, and only then may clearReactions and removeComments be set.
// The first takes back everything this person ever put on anyone, and lifting the ban does not
// bring it back. The second takes down everything he has standing, signed by the issuer.
public record CreateRestrictionRequest(
        @NotNull UUID userId,
        Instant expiresAt,
        @Size(max = 1000) String reason,
        // Boxed like the other optional fields here: an absent component arrives as null, which a
        // primitive refuses outright.
        Boolean clearReactions,
        Boolean removeComments) {}
