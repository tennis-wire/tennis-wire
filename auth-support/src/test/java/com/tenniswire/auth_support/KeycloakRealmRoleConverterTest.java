package com.tenniswire.auth_support;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

class KeycloakRealmRoleConverterTest {

    private final KeycloakRealmRoleConverter converter = new KeycloakRealmRoleConverter();

    @Test
    void mapsRealmRolesToPrefixedAuthorities() {
        var jwt = jwt(Map.of("realm_access", Map.of("roles", List.of("author", "admin"))));

        assertThat(converter.convert(jwt))
                .extracting(GrantedAuthority::getAuthority)
                .containsExactlyInAnyOrder("ROLE_author", "ROLE_admin");
    }

    @Test
    void tokenWithoutRealmAccessGrantsNothing() {
        var jwt = jwt(Map.of("scope", "openid profile"));

        assertThat(converter.convert(jwt)).isEmpty();
    }

    @Test
    void malformedRolesGrantNothingRatherThanFailing() {
        var jwt = jwt(Map.of("realm_access", Map.of("roles", "author")));

        assertThat(converter.convert(jwt)).isEmpty();
    }

    @Test
    void scopesAreNotAuthorities() {
        var jwt = jwt(Map.of("scope", "author", "realm_access", Map.of("roles", List.of())));

        assertThat(converter.convert(jwt)).isEmpty();
    }

    private static Jwt jwt(Map<String, Object> claims) {
        var builder = Jwt.withTokenValue("token").header("alg", "none");
        claims.forEach(builder::claim);
        return builder.build();
    }
}
