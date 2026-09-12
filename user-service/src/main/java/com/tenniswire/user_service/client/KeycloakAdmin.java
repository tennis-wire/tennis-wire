package com.tenniswire.user_service.client;

import com.tenniswire.user_service.exception.IdentityProviderUnavailableException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatusCode;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Slf4j
public class KeycloakAdmin {

    private static final ParameterizedTypeReference<List<Map<String, Object>>> ROWS =
            new ParameterizedTypeReference<>() {};
    private static final ParameterizedTypeReference<Map<String, Object>> FIELDS = new ParameterizedTypeReference<>() {};

    // Whatever we were about to take away is already gone, which is where we wanted to end up.
    private static final RestClient.ResponseSpec.ErrorHandler ALREADY_GONE = (request, response) -> {};

    private final RestClient http;
    private final String realm;

    public KeycloakAdmin(RestClient http, String realm) {
        this.http = http;
        this.realm = realm;
    }

    public void stripAndDisable(String subject) {
        // First and by itself: from here nothing new is issued in his name, whatever the rest does.
        // Empty strings rather than nulls — Keycloak leaves a field alone when the value is null.
        update(subject, Map.of("enabled", false, "firstName", "", "lastName", "", "attributes", Map.of()));
        logout(subject);
        removeCredentials(subject);
        unlinkProviders(subject);
    }

    public void delete(String subject) {
        call("delete the account", () -> http.delete()
                .uri("/admin/realms/{realm}/users/{id}", realm, subject)
                .retrieve()
                .onStatus(KeycloakAdmin::notFound, ALREADY_GONE)
                .toBodilessEntity());
    }

    //  How long an access token this realm issues stays good. What the erase has to outwait: a token
    // handed out a moment before the account was disabled is a self-contained JWT and goes on being
    // accepted until it expires.
    public Duration accessTokenLifespan() {
        var realmFields = call(
                "read the realm",
                () -> http.get().uri("/admin/realms/{realm}", realm).retrieve().body(FIELDS));
        var seconds = realmFields == null ? null : realmFields.get("accessTokenLifespan");
        if (!(seconds instanceof Number value)) {
            throw new IdentityProviderUnavailableException("realm " + realm + " reported no accessTokenLifespan");
        }
        return Duration.ofSeconds(value.longValue());
    }

    private void update(String subject, Map<String, Object> fields) {
        call("update the account", () -> http.put()
                .uri("/admin/realms/{realm}/users/{id}", realm, subject)
                .body(fields)
                .retrieve()
                .onStatus(KeycloakAdmin::notFound, ALREADY_GONE)
                .toBodilessEntity());
    }

    // Disabling does not reach a token already issued, but it does end what the browser is holding.
    private void logout(String subject) {
        call("end the sessions", () -> http.post()
                .uri("/admin/realms/{realm}/users/{id}/logout", realm, subject)
                .retrieve()
                .onStatus(KeycloakAdmin::notFound, ALREADY_GONE)
                .toBodilessEntity());
    }

    private void removeCredentials(String subject) {
        for (var credential : rowsOf(subject, "credentials", "read the credentials")) {
            var credentialId = String.valueOf(credential.get("id"));
            call("remove a credential", () -> http.delete()
                    .uri("/admin/realms/{realm}/users/{id}/credentials/{credentialId}", realm, subject, credentialId)
                    .retrieve()
                    .onStatus(KeycloakAdmin::notFound, ALREADY_GONE)
                    .toBodilessEntity());
        }
    }

    // Google and Apple links, so that nothing of which account at which provider this was survives.
    private void unlinkProviders(String subject) {
        for (var link : rowsOf(subject, "federated-identity", "read the linked providers")) {
            var provider = String.valueOf(link.get("identityProvider"));
            call("unlink a provider", () -> http.delete()
                    .uri("/admin/realms/{realm}/users/{id}/federated-identity/{provider}", realm, subject, provider)
                    .retrieve()
                    .onStatus(KeycloakAdmin::notFound, ALREADY_GONE)
                    .toBodilessEntity());
        }
    }

    private List<Map<String, Object>> rowsOf(String subject, String collection, String what) {
        var rows = call(what, () -> http.get()
                .uri("/admin/realms/{realm}/users/{id}/{collection}", realm, subject, collection)
                .retrieve()
                .onStatus(KeycloakAdmin::notFound, ALREADY_GONE)
                .body(ROWS));
        return rows == null ? List.of() : rows;
    }

    private static boolean notFound(HttpStatusCode status) {
        return status.value() == 404;
    }

    private <T> T call(String what, Supplier<T> operation) {
        try {
            return operation.get();
        } catch (RestClientException e) {
            log.warn("Keycloak could not {} in realm {}: {}", what, realm, e.getMessage());
            throw new IdentityProviderUnavailableException("Keycloak could not " + what, e);
        }
    }
}
