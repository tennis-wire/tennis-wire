package com.tenniswire.api_gateway;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.getRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.matching;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.options;
import static java.nio.charset.StandardCharsets.UTF_8;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.tomakehurst.wiremock.WireMockServer;
import dasniko.testcontainers.keycloak.KeycloakContainer;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * The one slow test: a real Keycloak importing the same realm file docker-compose uses, and a stub
 * standing in for the downstream service.
 *
 * <p>This is what proves the parts the fast tests take on trust: that the realm file is valid, that
 * the audience mapper fires, that realm_access.roles survives into an authority, and that the
 * Authorization header reaches the service behind the gateway.
 *
 * <p>Tokens are fetched over plain HTTP rather than with the container's helper methods, whose
 * signatures move between versions of the Keycloak testcontainer.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Testcontainers
class GatewayKeycloakIT {

    private static final String REALM = "tennis-wire";
    private static final String CLI = "dev-cli";
    private static final String EDITORIAL = "/api/editorial/articles";

    // Keep the tag in step with docker-compose.yml: the point of this test is that both
    // read the same realm file on the same server version.
    @Container
    private static final KeycloakContainer KEYCLOAK =
            new KeycloakContainer("quay.io/keycloak/keycloak:26.7.0").withRealmImportFile("/tennis-wire-realm.json");

    private static final WireMockServer DOWNSTREAM =
            new WireMockServer(options().dynamicPort());

    private static final HttpClient HTTP = HttpClient.newHttpClient();
    private static final ObjectMapper MAPPER = new ObjectMapper();

    static {
        // Started here rather than in @BeforeAll: @DynamicPropertySource runs first and
        // needs the port.
        DOWNSTREAM.start();
        DOWNSTREAM.stubFor(get(urlPathEqualTo(EDITORIAL)).willReturn(aResponse().withStatus(200)));
    }

    @DynamicPropertySource
    static void gatewayProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.security.oauth2.resourceserver.jwt.issuer-uri", GatewayKeycloakIT::realmUrl);
        registry.add("test.downstream-url", DOWNSTREAM::baseUrl);
    }

    @AfterAll
    static void stopDownstream() {
        DOWNSTREAM.stop();
    }

    private WebTestClient client;

    // Bound by hand rather than injected: Boot no longer registers a WebTestClient bean
    // for RANDOM_PORT, and local.server.port is a plain property either way.
    @BeforeEach
    void bindToServer(@Autowired Environment environment) {
        client = WebTestClient.bindToServer()
                .baseUrl("http://localhost:" + environment.getProperty("local.server.port"))
                .build();
    }

    @Test
    void authorTokenPassesAndTheHeaderIsRelayed() {
        client.get()
                .uri(EDITORIAL)
                .header(HttpHeaders.AUTHORIZATION, bearer(passwordToken("dev", "dev")))
                .exchange()
                .expectStatus()
                .isOk();

        DOWNSTREAM.verify(getRequestedFor(urlPathEqualTo(EDITORIAL))
                .withHeader(HttpHeaders.AUTHORIZATION, matching("Bearer .+")));
    }

    @Test
    void readerTokenIsForbidden() {
        client.get()
                .uri(EDITORIAL)
                .header(HttpHeaders.AUTHORIZATION, bearer(passwordToken("reader", "reader")))
                .exchange()
                .expectStatus()
                .isForbidden();
    }

    @Test
    void botTokenIsForbiddenOnEditorial() {
        client.get()
                .uri(EDITORIAL)
                .header(HttpHeaders.AUTHORIZATION, bearer(clientCredentialsToken()))
                .exchange()
                .expectStatus()
                .isForbidden();
    }

    @Test
    void anonymousIsUnauthorized() {
        client.get().uri(EDITORIAL).exchange().expectStatus().isUnauthorized();
    }

    @Test
    void garbageTokenIsUnauthorized() {
        client.get()
                .uri(EDITORIAL)
                .header(HttpHeaders.AUTHORIZATION, "Bearer not.a.jwt")
                .exchange()
                .expectStatus()
                .isUnauthorized();
    }

    private static String realmUrl() {
        return KEYCLOAK.getAuthServerUrl().replaceAll("/+$", "") + "/realms/" + REALM;
    }

    private static String passwordToken(String username, String password) {
        return accessToken(Map.of(
                "grant_type", "password",
                "client_id", CLI,
                "username", username,
                "password", password));
    }

    private static String clientCredentialsToken() {
        return accessToken(Map.of(
                "grant_type", "client_credentials",
                "client_id", "moderation-bot",
                "client_secret", "dev-moderation-bot-secret"));
    }

    private static String accessToken(Map<String, String> form) {
        var body = form.entrySet().stream()
                .map(entry ->
                        URLEncoder.encode(entry.getKey(), UTF_8) + "=" + URLEncoder.encode(entry.getValue(), UTF_8))
                .collect(Collectors.joining("&"));

        var request = HttpRequest.newBuilder(URI.create(realmUrl() + "/protocol/openid-connect/token"))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body, UTF_8))
                .build();

        try {
            var response = HTTP.send(request, HttpResponse.BodyHandlers.ofString(UTF_8));
            if (response.statusCode() != 200) {
                throw new IllegalStateException(
                        "Token request failed: " + response.statusCode() + " " + response.body());
            }
            return MAPPER.readTree(response.body()).path("access_token").asText();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }
}
