package com.tenniswire.user_service;

import static java.util.Objects.requireNonNull;
import static org.assertj.core.api.Assertions.assertThat;

import com.tenniswire.user_service.client.KeycloakAdmin;
import dasniko.testcontainers.keycloak.KeycloakContainer;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Testcontainers
class KeycloakStripIT {

    private static final String REALM = "tennis-wire";

    // Keep the tag in step with docker-compose.yml: the point of this test is that both read the
    // same realm file on the same server version.
    @Container
    private static final KeycloakContainer KEYCLOAK =
            new KeycloakContainer("quay.io/keycloak/keycloak:26.7.0").withRealmImportFile("/tennis-wire-realm.json");

    private static final ParameterizedTypeReference<Map<String, Object>> FIELDS = new ParameterizedTypeReference<>() {};
    private static final ParameterizedTypeReference<List<Map<String, Object>>> ROWS =
            new ParameterizedTypeReference<>() {};

    @Autowired
    private KeycloakAdmin admin;

    @DynamicPropertySource
    static void pointAtTheContainer(DynamicPropertyRegistry registry) {
        registry.add("user.keycloak.base-url", KEYCLOAK::getAuthServerUrl);
        registry.add(
                "spring.security.oauth2.client.provider.keycloak.token-uri",
                () -> KEYCLOAK.getAuthServerUrl() + "/realms/" + REALM + "/protocol/openid-connect/token");
        registry.add(
                "spring.security.oauth2.resourceserver.jwt.issuer-uri",
                () -> KEYCLOAK.getAuthServerUrl() + "/realms/" + REALM);
    }

    @Test
    void aStrippedAccountKeepsItsAddressAndNothingElse() {
        var email = "leaving-" + UUID.randomUUID() + "@example.test";
        var subject = createReader(email, "before");

        admin.stripAndDisable(subject);

        var account = getUser(subject);
        // the address is what holds the registration closed
        assertThat(account.get("email")).isEqualTo(email);
        assertThat(account.get("username")).isEqualTo(email);
        assertThat(account.get("enabled")).isEqualTo(false);
        assertThat(account.get("firstName")).isIn(null, "");
        assertThat(account.get("lastName")).isIn(null, "");
        assertThat(credentialsOf(subject)).isEmpty();
    }

    @Test
    void aStrippedAccountCannotBeSignedIntoAndItsAddressCannotBeTakenAgain() {
        var email = "banned-" + UUID.randomUUID() + "@example.test";
        var subject = createReader(email, "before");

        admin.stripAndDisable(subject);

        assertThat(signInFails(email, "before")).isTrue();
        assertThat(creatingAnotherAccountOn(email)).isEqualTo(409);
    }

    @Test
    void strippingTwiceIsHarmlessAndDeletingWhatIsAlreadyGoneIsNot() {
        var email = "twice-" + UUID.randomUUID() + "@example.test";
        var subject = createReader(email, "before");

        admin.stripAndDisable(subject);
        admin.stripAndDisable(subject);
        admin.delete(subject);
        admin.delete(subject);

        assertThat(creatingAnotherAccountOn(email)).isEqualTo(201);
    }

    @Test
    void theLifespanComesBackFromTheRealmItself() {
        assertThat(admin.accessTokenLifespan()).isPositive();
    }

    private String createReader(String email, String password) {
        var response = asAdmin()
                .post()
                .uri("/admin/realms/{realm}/users", REALM)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of(
                        "username",
                        email,
                        "email",
                        email,
                        "emailVerified",
                        true,
                        "enabled",
                        true,
                        "firstName",
                        "Given",
                        "lastName",
                        "Family",
                        "credentials",
                        List.of(Map.of("type", "password", "value", password, "temporary", false))))
                .retrieve()
                .toBodilessEntity();
        var created =
                requireNonNull(response.getHeaders().getLocation(), "Keycloak created a user without saying where");
        var path = created.getPath();
        return path.substring(path.lastIndexOf('/') + 1);
    }

    private Map<String, Object> getUser(String subject) {
        return requireNonNull(
                asAdmin()
                        .get()
                        .uri("/admin/realms/{realm}/users/{id}", REALM, subject)
                        .retrieve()
                        .body(FIELDS),
                "Keycloak answered with no user representation");
    }

    private List<Map<String, Object>> credentialsOf(String subject) {
        var rows = asAdmin()
                .get()
                .uri("/admin/realms/{realm}/users/{id}/credentials", REALM, subject)
                .retrieve()
                .body(ROWS);
        return rows == null ? List.of() : rows;
    }

    private boolean signInFails(String email, String password) {
        var form = new LinkedMultiValueMap<String, String>();
        form.add("grant_type", "password");
        form.add("client_id", "dev-cli");
        form.add("username", email);
        form.add("password", password);
        return RestClient.create()
                .post()
                .uri(tokenEndpoint())
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .onStatus(status -> true, (request, response) -> {})
                .toBodilessEntity()
                .getStatusCode()
                .isError();
    }

    private int creatingAnotherAccountOn(String email) {
        return asAdmin()
                .post()
                .uri("/admin/realms/{realm}/users", REALM)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("username", email, "email", email, "enabled", true))
                .retrieve()
                .onStatus(status -> true, (request, response) -> {})
                .toBodilessEntity()
                .getStatusCode()
                .value();
    }

    private RestClient asAdmin() {
        return RestClient.builder()
                .baseUrl(KEYCLOAK.getAuthServerUrl())
                .defaultHeader("Authorization", "Bearer " + serviceToken())
                .build();
    }

    private String serviceToken() {
        var form = new LinkedMultiValueMap<String, String>();
        form.add("grant_type", "client_credentials");
        form.add("client_id", "user-service");
        form.add("client_secret", "dev-user-service-secret");
        var answer = RestClient.create()
                .post()
                .uri(tokenEndpoint())
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .body(FIELDS);
        return String.valueOf(requireNonNull(answer, "Keycloak answered the token request with no body")
                .get("access_token"));
    }

    private static URI tokenEndpoint() {
        return URI.create(KEYCLOAK.getAuthServerUrl() + "/realms/" + REALM + "/protocol/openid-connect/token");
    }
}
