package com.tenniswire.api_gateway;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.delete;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.getRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.matching;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathMatching;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.options;
import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.tomakehurst.wiremock.WireMockServer;
import dasniko.testcontainers.keycloak.KeycloakContainer;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
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

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Testcontainers
class GatewayKeycloakIT {

    private static final String REALM = "tennis-wire";
    private static final String CLI = "dev-cli";
    private static final String EDITORIAL = "/api/editorial/articles";
    private static final String USERS_ME = "/api/users/me";
    private static final String SOMEONES_ACCOUNT = "/api/users/8f1d9c4e-3a2b-4c5d-9e6f-0a1b2c3d4e5f";

    // The clients readers sign in through. Neither allows the password grant, so their tokens come
    // only from the code flow, which signInThroughTheBrowser runs the way a browser would. The app is
    // a public client: no secret. Its callback is never followed, only matched against the realm.
    private static final ReaderClient SITE =
            new ReaderClient("public-web", "dev-public-web-secret", "http://localhost:3000/api/auth/callback/keycloak");
    private static final ReaderClient APP = new ReaderClient("mobile", "", "tenniswire://auth");

    private static final Pattern LOGIN_FORM_ACTION = Pattern.compile("<form[^>]*action=\"([^\"]+)\"");
    private static final SecureRandom RANDOM = new SecureRandom();

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
        DOWNSTREAM.stubFor(delete(urlPathMatching("/api/users/[^/]+"))
                .willReturn(aResponse().withStatus(202)));
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
    void aServiceAccountHasNoReaderRole() {
        client.get()
                .uri(USERS_ME)
                .header(
                        HttpHeaders.AUTHORIZATION,
                        bearer(clientCredentialsToken("discussion-service", "dev-discussion-service-secret")))
                .exchange()
                .expectStatus()
                .isForbidden();
    }

    @Test
    void deletingSomebodyElsesAccountNeedsAnAdmin() {
        // The reader has the role that opens /me, and that is deliberately not enough here.
        client.delete()
                .uri(SOMEONES_ACCOUNT)
                .header(HttpHeaders.AUTHORIZATION, bearer(passwordToken("reader", "reader")))
                .exchange()
                .expectStatus()
                .isForbidden();

        client.delete()
                .uri(SOMEONES_ACCOUNT)
                .header(HttpHeaders.AUTHORIZATION, bearer(passwordToken("dev", "dev")))
                .exchange()
                .expectStatus()
                .isAccepted();
    }

    @Test
    void anAdminSignedInOnTheSiteIsAReaderAndAnAuthorThere() {
        var tokens = signInThroughTheBrowser(SITE, "dev", "dev");

        // offline_access is outside the client's role scope and arrives with the client scope of the
        // same name. Were it lost, the code exchange would be refused rather than downgraded
        assertThat(claims(tokens, "refresh_token").path("typ").asText()).isEqualTo("Offline");
        // author stays for the link to the editor
        assertThat(roles(claims(tokens, "id_token"))).contains("user", "author");
        assertThat(roles(claims(tokens, "access_token"))).doesNotContain("admin", "moderator", "chief-editor");

        // Through dev-cli the same person is let in: deletingSomebodyElsesAccountNeedsAnAdmin
        client.delete()
                .uri(SOMEONES_ACCOUNT)
                .header(
                        HttpHeaders.AUTHORIZATION,
                        bearer(tokens.path("access_token").asText()))
                .exchange()
                .expectStatus()
                .isForbidden();
    }

    @Test
    void anAdminSignedInOnTheAppIsAReaderThere() {
        var tokens = signInThroughTheBrowser(APP, "dev", "dev");

        assertThat(claims(tokens, "refresh_token").path("typ").asText()).isEqualTo("Offline");
        assertThat(roles(claims(tokens, "access_token")))
                .contains("user")
                .doesNotContain("admin", "moderator", "chief-editor", "author");
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
    void tokenForAnotherAudienceIsUnauthorized() {
        // Correctly signed by our realm, for a real user with the author role, but carrying
        // no aud=tennis-wire-api. Rejected before authorities are ever considered, so this
        // is a 401 rather than a 403.
        var token = passwordToken("no-audience", "dev", "dev");

        client.get()
                .uri(EDITORIAL)
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .exchange()
                .expectStatus()
                .isUnauthorized();
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
        return passwordToken(CLI, username, password);
    }

    private static String passwordToken(String clientId, String username, String password) {
        return accessToken(Map.of(
                "grant_type", "password",
                "client_id", clientId,
                "username", username,
                "password", password));
    }

    private static String clientCredentialsToken() {
        return clientCredentialsToken("moderation-bot", "dev-moderation-bot-secret");
    }

    private static String clientCredentialsToken(String clientId, String secret) {
        return accessToken(Map.of(
                "grant_type", "client_credentials",
                "client_id", clientId,
                "client_secret", secret));
    }

    private static String accessToken(Map<String, String> form) {
        return tokens(form).path("access_token").asText();
    }

    private static JsonNode tokens(Map<String, String> form) {
        var request = HttpRequest.newBuilder(URI.create(realmUrl() + "/protocol/openid-connect/token"))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(formBody(form), UTF_8))
                .build();

        try {
            var response = HTTP.send(request, HttpResponse.BodyHandlers.ofString(UTF_8));
            if (response.statusCode() != 200) {
                throw new IllegalStateException(
                        "Token request failed: " + response.statusCode() + " " + response.body());
            }
            return MAPPER.readTree(response.body());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }

    // The login page, the form posted back, and the code from the redirect exchanged for tokens.
    // Cookies are carried by hand: Keycloak marks them Secure, and the JDK's cookie handler will not
    // send those over plain http, which is all the container speaks.
    private static JsonNode signInThroughTheBrowser(ReaderClient reader, String username, String password) {
        var verifier = randomToken();
        var cookies = new HashMap<String, String>();

        var authorize = new LinkedHashMap<String, String>();
        authorize.put("client_id", reader.id());
        authorize.put("response_type", "code");
        authorize.put("scope", "openid offline_access");
        authorize.put("redirect_uri", reader.callback());
        authorize.put("code_challenge", challengeOf(verifier));
        authorize.put("code_challenge_method", "S256");
        var loginPage = browse(
                HttpRequest.newBuilder(URI.create(realmUrl() + "/protocol/openid-connect/auth?" + formBody(authorize)))
                        .GET(),
                cookies);

        var action = LOGIN_FORM_ACTION.matcher(loginPage.body());
        if (!action.find()) {
            throw new IllegalStateException("No login form: " + loginPage.statusCode() + " " + loginPage.body());
        }
        var submitted = browse(
                HttpRequest.newBuilder(URI.create(action.group(1).replace("&amp;", "&")))
                        .header("Content-Type", "application/x-www-form-urlencoded")
                        .POST(HttpRequest.BodyPublishers.ofString(
                                formBody(Map.of("username", username, "password", password)), UTF_8)),
                cookies);
        var callback = submitted
                .headers()
                .firstValue("Location")
                .orElseThrow(() -> new IllegalStateException("Login refused: " + submitted.statusCode()));

        var exchange = new LinkedHashMap<String, String>();
        exchange.put("grant_type", "authorization_code");
        exchange.put("code", queryParameter(callback, "code"));
        exchange.put("redirect_uri", reader.callback());
        exchange.put("code_verifier", verifier);
        exchange.put("client_id", reader.id());
        if (!reader.secret().isEmpty()) {
            exchange.put("client_secret", reader.secret());
        }
        return tokens(exchange);
    }

    private static HttpResponse<String> browse(HttpRequest.Builder request, Map<String, String> cookies) {
        if (!cookies.isEmpty()) {
            request.header(
                    "Cookie",
                    cookies.entrySet().stream()
                            .map(cookie -> cookie.getKey() + "=" + cookie.getValue())
                            .collect(Collectors.joining("; ")));
        }
        try {
            var response = HTTP.send(request.build(), HttpResponse.BodyHandlers.ofString(UTF_8));
            for (var header : response.headers().allValues("Set-Cookie")) {
                var pair = header.split(";", 2)[0].split("=", 2);
                cookies.put(pair[0], pair.length > 1 ? pair[1] : "");
            }
            return response;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }

    private static String formBody(Map<String, String> form) {
        return form.entrySet().stream()
                .map(entry ->
                        URLEncoder.encode(entry.getKey(), UTF_8) + "=" + URLEncoder.encode(entry.getValue(), UTF_8))
                .collect(Collectors.joining("&"));
    }

    private static String queryParameter(String url, String name) {
        for (var parameter : URI.create(url).getRawQuery().split("&")) {
            var pair = parameter.split("=", 2);
            if (pair[0].equals(name) && pair.length > 1) {
                return URLDecoder.decode(pair[1], UTF_8);
            }
        }
        throw new IllegalStateException("No " + name + " in " + url);
    }

    private static String randomToken() {
        var bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String challengeOf(String verifier) {
        try {
            var digest = MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    // The payload only: the signature is not what these tests are about
    private static JsonNode claims(JsonNode tokens, String name) {
        var payload = tokens.path(name).asText().split("\\.")[1];
        try {
            return MAPPER.readTree(Base64.getUrlDecoder().decode(payload));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static List<String> roles(JsonNode claims) {
        var roles = new ArrayList<String>();
        claims.path("realm_access").path("roles").forEach(role -> roles.add(role.asText()));
        return roles;
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }

    private record ReaderClient(String id, String secret, String callback) {}
}
