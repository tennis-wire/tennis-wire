package com.tenniswire.content_service.security;

import com.tenniswire.auth_support.Roles;
import com.tenniswire.content_service.exception.ForbiddenException;
import java.util.UUID;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

// The caller as the editorial rules see him. Staff are identified by the token's subject as is:
// there is no internal user id on this side.
public record Staff(UUID id, String name, boolean chiefEditor) {

    private static final String CHIEF_EDITOR = "ROLE_" + Roles.CHIEF_EDITOR;

    public static Staff of(JwtAuthenticationToken token) {
        var jwt = token.getToken();
        var id = idFrom(jwt.getSubject());
        var username = jwt.getClaimAsString("preferred_username");
        var chiefEditor =
                token.getAuthorities().stream().anyMatch(authority -> CHIEF_EDITOR.equals(authority.getAuthority()));
        return new Staff(id, username == null || username.isBlank() ? id.toString() : username, chiefEditor);
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
