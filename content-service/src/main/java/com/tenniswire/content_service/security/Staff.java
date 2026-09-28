package com.tenniswire.content_service.security;

import com.tenniswire.auth_support.Roles;
import com.tenniswire.content_service.exception.ForbiddenException;
import java.util.UUID;
import java.util.stream.Stream;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

// The caller as the editorial rules see him. Staff are identified by the token's subject as is:
// there is no internal user id on this side.
public record Staff(UUID id, String name, boolean chiefEditor) {

    private static final String CHIEF_EDITOR = "ROLE_" + Roles.CHIEF_EDITOR;

    public static Staff of(JwtAuthenticationToken token) {
        var jwt = token.getToken();
        var id = idFrom(jwt.getSubject());
        var chiefEditor =
                token.getAuthorities().stream().anyMatch(authority -> CHIEF_EDITOR.equals(authority.getAuthority()));
        // Full name first: the username is the email
        var name = Stream.of(jwt.getClaimAsString("name"), jwt.getClaimAsString("preferred_username"))
                .filter(claim -> claim != null && !claim.isBlank())
                .findFirst()
                .orElse(id.toString());
        return new Staff(id, name, chiefEditor);
    }

    private static UUID idFrom(String subject) {
        if (subject == null) {
            throw new ForbiddenException("The token names no subject");
        }
        try {
            return UUID.fromString(subject);
        } catch (IllegalArgumentException e) {
            throw new ForbiddenException("The token's subject is not a staff id");
        }
    }
}
