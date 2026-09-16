package com.tenniswire.user_service.client;

import com.tenniswire.user_service.exception.IdentityProviderUnavailableException;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatusCode;
import org.springframework.security.oauth2.core.OAuth2AuthorizationException;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
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
        var account = read(subject);
        if (account == null) {
            return;
        }
        // Read, change, write the whole thing back. An update replaces the representation rather
        // than merging into it, so a body carrying only what changed would clear every root
        // attribute left out of it, the address among them, which is the one thing that must stay.
        var stripped = new LinkedHashMap<>(account);
        stripped.put("enabled", false);
        stripped.put("firstName", "");
        stripped.put("lastName", "");
        update(subject, stripped);

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

    // How long an access token this realm issues stays good. What the erase has to outwait: a token
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

    private Map<String, Object> read(String subject) {
        return call("read the account", () -> http.get()
                .uri("/admin/realms/{realm}/users/{id}", realm, subject)
                .retrieve()
                .onStatus(KeycloakAdmin::notFound, ALREADY_GONE)
                .body(FIELDS));
    }

    private void update(String subject, Map<String, Object> account) {
        call("update the account", () -> http.put()
                .uri("/admin/realms/{realm}/users/{id}", realm, subject)
                .body(account)
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
        } catch (HttpClientErrorException e) {
            // Not an outage. A 400 is a body built wrong here; a 401 or 403 is the service token or
            // the realm-management roles behind it. Asking again fixes neither.
            log.error("Keycloak refused to {} in realm {} with {}", what, realm, e.getStatusCode());
            throw new IdentityProviderUnavailableException("Keycloak refused to " + what, e);
        } catch (RestClientException e) {
            log.warn("Keycloak could not {} in realm {}: {}", what, realm, e.getMostSpecificCause());
            throw new IdentityProviderUnavailableException("Keycloak could not " + what, e);
        } catch (OAuth2AuthorizationException e) {
            // Thrown while getting the service token, before the admin API is reached at all. An
            // unreachable Keycloak is an outage; a refusal means this client is misconfigured.
            var cause = e.getCause();
            if (cause instanceof ResourceAccessException || cause instanceof HttpServerErrorException) {
                log.warn("service token request failed: {}", NestedExceptionUtils.getMostSpecificCause(e));
            } else {
                log.error("service token request refused: {}", e.getError());
            }
            throw new IdentityProviderUnavailableException("service token unavailable", e);
        }
    }
}
