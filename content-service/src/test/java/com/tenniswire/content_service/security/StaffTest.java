package com.tenniswire.content_service.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

class StaffTest {

    private static final UUID ID = UUID.randomUUID();

    @Test
    void nameIsTheFullNameNotTheUsername() {
        // The realm uses the email as the username
        var staff = Staff.of(token(Map.of("name", "Anna Petrova", "preferred_username", "anna@tennis-wire.local")));

        assertThat(staff.name()).isEqualTo("Anna Petrova");
    }

    @Test
    void withoutAFullNameTheUsernameStands() {
        var staff = Staff.of(token(Map.of("preferred_username", "anna@tennis-wire.local")));

        assertThat(staff.name()).isEqualTo("anna@tennis-wire.local");
    }

    @Test
    void blankFullNameCountsAsNone() {
        var staff = Staff.of(token(Map.of("name", " ", "preferred_username", "anna@tennis-wire.local")));

        assertThat(staff.name()).isEqualTo("anna@tennis-wire.local");
    }

    @Test
    void withNeitherTheSubjectStands() {
        var staff = Staff.of(token(Map.of()));

        assertThat(staff.name()).isEqualTo(ID.toString());
    }

    private static JwtAuthenticationToken token(Map<String, Object> claims) {
        var builder = Jwt.withTokenValue("token").header("alg", "none").subject(ID.toString());
        claims.forEach(builder::claim);
        return new JwtAuthenticationToken(builder.build(), List.of());
    }
}
