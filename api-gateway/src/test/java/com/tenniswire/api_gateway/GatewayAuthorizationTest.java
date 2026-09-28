package com.tenniswire.api_gateway;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.springframework.security.test.web.reactive.server.SecurityMockServerConfigurers.mockJwt;
import static org.springframework.security.test.web.reactive.server.SecurityMockServerConfigurers.springSecurity;

import com.tenniswire.auth_support.Roles;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.http.HttpMethod;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.reactive.server.SecurityMockServerConfigurers.JwtMutator;
import org.springframework.test.web.reactive.server.WebTestClient;

@SpringBootTest
class GatewayAuthorizationTest {

    private static final String EDITOR = "editorial-ui";
    private static final String BOT = "moderation-bot";

    private WebTestClient client;

    @BeforeEach
    void bindToChain(@Autowired ApplicationContext context) {
        client = WebTestClient.bindToApplicationContext(context)
                .apply(springSecurity())
                .configureClient()
                .baseUrl("http://localhost:8090")
                .build();
    }

    @Test
    void editorialRejectsAnonymous() {
        client.get().uri("/api/editorial/articles").exchange().expectStatus().isUnauthorized();
    }

    @Test
    void editorialRejectsNonAuthorRole() {
        client.mutateWith(mockJwt().authorities(new SimpleGrantedAuthority("ROLE_user")))
                .get()
                .uri("/api/editorial/articles")
                .exchange()
                .expectStatus()
                .isForbidden();
    }

    @Test
    void editorialAcceptsAuthorRole() {
        // 500 is the proxy failing to reach a downstream that is not running in this test:
        // reaching the proxy at all is what proves authorization passed.
        client.mutateWith(through(EDITOR, Roles.AUTHOR))
                .get()
                .uri("/api/editorial/articles")
                .exchange()
                .expectStatus()
                .is5xxServerError();
    }

    @Test
    void gatewayActuatorRejectsAnonymous() {
        client.get().uri("/actuator/gateway").exchange().expectStatus().isUnauthorized();
    }

    @Test
    void gatewayActuatorRejectsNonAdmin() {
        client.mutateWith(mockJwt().authorities(new SimpleGrantedAuthority("ROLE_author")))
                .get()
                .uri("/actuator/gateway")
                .exchange()
                .expectStatus()
                .isForbidden();
    }

    @Test
    void healthIsAnonymousAndCarriesNoDetails() {
        client.get()
                .uri("/actuator/health")
                .exchange()
                .expectStatus()
                .isOk()
                .expectBody()
                .jsonPath("$.status")
                .isEqualTo("UP")
                .jsonPath("$.components")
                .doesNotExist();
    }

    // The upstream is not running here, so what is asserted is that the chain did not stop it
    @Test
    void aReaderProfileByIdPassesWithoutAToken() {
        client.get()
                .uri("/api/users/" + UUID.randomUUID())
                .exchange()
                .expectStatus()
                .value(code -> assertThat(code).isNotIn(401, 403));
    }

    @Test
    void anAuthorCardPassesWithoutAToken() {
        client.get()
                .uri("/api/discussion/authors/" + UUID.randomUUID())
                .exchange()
                .expectStatus()
                .value(code -> assertThat(code).isNotIn(401, 403));
    }

    @Test
    void aPollIsReadByAnyoneMadeByAnAuthorAndVotedOnByAReader() {
        var reader = mockJwt().authorities(new SimpleGrantedAuthority("ROLE_user"));
        var author = through(EDITOR, Roles.AUTHOR);
        var poll = "/api/discussion/polls/" + UUID.randomUUID();

        client.get().uri(poll).exchange().expectStatus().value(code -> assertThat(code)
                .isNotIn(401, 403));
        client.put().uri(poll + "/vote").exchange().expectStatus().isUnauthorized();
        client.mutateWith(author)
                .put()
                .uri(poll + "/vote")
                .exchange()
                .expectStatus()
                .isForbidden();
        client.mutateWith(reader)
                .put()
                .uri(poll + "/vote")
                .exchange()
                .expectStatus()
                .value(code -> assertThat(code).isNotIn(401, 403));
        client.mutateWith(reader)
                .post()
                .uri("/api/discussion/polls")
                .exchange()
                .expectStatus()
                .isForbidden();
        client.mutateWith(reader).patch().uri(poll).exchange().expectStatus().isForbidden();
        client.mutateWith(reader)
                .put()
                .uri(poll + "/closing")
                .exchange()
                .expectStatus()
                .isForbidden();
        client.mutateWith(author)
                .post()
                .uri("/api/discussion/polls")
                .exchange()
                .expectStatus()
                .value(code -> assertThat(code).isNotIn(401, 403));
    }

    @Test
    void avatarReviewIsAModeratorsAlone() {
        var reader = mockJwt().authorities(new SimpleGrantedAuthority("ROLE_user"));
        var moderator = through(EDITOR, Roles.MODERATOR);
        var someone = "/api/users/" + UUID.randomUUID();

        client.mutateWith(reader)
                .get()
                .uri("/api/users/moderation/avatars")
                .exchange()
                .expectStatus()
                .isForbidden();
        client.mutateWith(reader)
                .delete()
                .uri(someone + "/avatar")
                .exchange()
                .expectStatus()
                .isForbidden();
        client.mutateWith(reader)
                .put()
                .uri(someone + "/avatar/review")
                .exchange()
                .expectStatus()
                .isForbidden();
        client.mutateWith(moderator)
                .get()
                .uri("/api/users/moderation/avatars")
                .exchange()
                .expectStatus()
                .value(code -> assertThat(code).isNotIn(401, 403));
    }

    @Test
    void commentRemovalIsAModeratorsAlone() {
        var hide = "/api/discussion/moderation/comments/" + UUID.randomUUID();

        client.mutateWith(through(BOT, Roles.MODERATOR_BOT))
                .delete()
                .uri(hide)
                .exchange()
                .expectStatus()
                .isForbidden();
        client.mutateWith(through(EDITOR, Roles.MODERATOR))
                .delete()
                .uri(hide)
                .exchange()
                .expectStatus()
                .value(code -> assertThat(code).isNotIn(401, 403));
    }

    @Test
    void theBotStillFilesReports() {
        client.mutateWith(through(BOT, Roles.MODERATOR_BOT))
                .post()
                .uri("/api/discussion/moderation/reports")
                .exchange()
                .expectStatus()
                .value(code -> assertThat(code).isNotIn(401, 403));
    }

    // Roles still decide; azp only refuses a token some other client was handed (staff.md §8)
    @ParameterizedTest
    @MethodSource("staffRoutes")
    void aStaffRouteTakesTheEditorsTokenAlone(HttpMethod method, String path, String role) {
        client.mutateWith(through(EDITOR, role))
                .method(method)
                .uri(path)
                .exchange()
                .expectStatus()
                .value(code -> assertThat(code).isNotIn(401, 403));
        for (var other : List.of("public-web", "mobile", "dev-cli", BOT)) {
            client.mutateWith(through(other, role))
                    .method(method)
                    .uri(path)
                    .exchange()
                    .expectStatus()
                    .isForbidden();
        }
        client.mutateWith(mockJwt().authorities(new SimpleGrantedAuthority("ROLE_" + role)))
                .method(method)
                .uri(path)
                .exchange()
                .expectStatus()
                .isForbidden();
    }

    static Stream<Arguments> staffRoutes() {
        var someone = "/api/users/" + UUID.randomUUID();
        var poll = "/api/discussion/polls/" + UUID.randomUUID();
        return Stream.of(
                arguments(HttpMethod.GET, "/api/editorial/articles", Roles.AUTHOR),
                arguments(HttpMethod.POST, "/api/ai/chat", Roles.AUTHOR),
                arguments(HttpMethod.POST, "/api/translate", Roles.AUTHOR),
                arguments(HttpMethod.POST, "/api/transcribe/jobs", Roles.AUTHOR),
                arguments(HttpMethod.POST, "/api/discussion/polls", Roles.AUTHOR),
                arguments(HttpMethod.PATCH, poll, Roles.AUTHOR),
                arguments(HttpMethod.PUT, poll + "/closing", Roles.AUTHOR),
                arguments(HttpMethod.GET, "/api/discussion/moderation/reports", Roles.MODERATOR),
                arguments(HttpMethod.PATCH, "/api/discussion/moderation/reports/" + UUID.randomUUID(), Roles.MODERATOR),
                arguments(HttpMethod.POST, "/api/discussion/moderation/restrictions", Roles.MODERATOR),
                arguments(
                        HttpMethod.DELETE, "/api/discussion/moderation/comments/" + UUID.randomUUID(), Roles.MODERATOR),
                arguments(HttpMethod.GET, "/api/users/moderation/avatars", Roles.MODERATOR),
                arguments(HttpMethod.PUT, someone + "/avatar/review", Roles.MODERATOR),
                arguments(HttpMethod.DELETE, someone + "/avatar", Roles.MODERATOR),
                arguments(HttpMethod.DELETE, someone, Roles.ADMIN));
    }

    @Test
    void theBotFilesReportsWithItsOwnTokenAlone() {
        var reports = "/api/discussion/moderation/reports";

        for (var other : List.of(EDITOR, "dev-cli")) {
            client.mutateWith(through(other, Roles.MODERATOR_BOT))
                    .post()
                    .uri(reports)
                    .exchange()
                    .expectStatus()
                    .isForbidden();
        }
        client.mutateWith(mockJwt().authorities(new SimpleGrantedAuthority("ROLE_moderator-bot")))
                .post()
                .uri(reports)
                .exchange()
                .expectStatus()
                .isForbidden();
    }

    // Filing a report is all the bot does, and a report is only ever the bot's
    @Test
    void theBotReachesNothingElseInModeration() {
        var bot = through(BOT, Roles.MODERATOR_BOT);
        var reports = "/api/discussion/moderation/reports";

        client.mutateWith(bot).get().uri(reports).exchange().expectStatus().isForbidden();
        client.mutateWith(bot)
                .patch()
                .uri(reports + "/" + UUID.randomUUID())
                .exchange()
                .expectStatus()
                .isForbidden();
        client.mutateWith(bot)
                .post()
                .uri("/api/discussion/moderation/restrictions")
                .exchange()
                .expectStatus()
                .isForbidden();
        client.mutateWith(through(EDITOR, Roles.MODERATOR))
                .post()
                .uri(reports)
                .exchange()
                .expectStatus()
                .isForbidden();
    }

    @Test
    void aReaderStillReachesHisOwnAvatar() {
        client.mutateWith(mockJwt().authorities(new SimpleGrantedAuthority("ROLE_user")))
                .delete()
                .uri("/api/users/me/avatar")
                .exchange()
                .expectStatus()
                .value(code -> assertThat(code).isNotIn(401, 403));
    }

    @Test
    void ownProfileStillRejectsAnonymous() {
        client.get().uri("/api/users/me").exchange().expectStatus().isUnauthorized();
    }

    @Test
    void pathWithoutARuleIsDeniedEvenForAdmin() {
        client.mutateWith(mockJwt().authorities(new SimpleGrantedAuthority("ROLE_admin")))
                .get()
                .uri("/api/comments/1")
                .exchange()
                .expectStatus()
                .isForbidden();
    }

    @Test
    void preflightPassesWithoutToken() {
        client.options()
                .uri("/api/editorial/articles")
                .header("Origin", "http://localhost:5173")
                .header("Access-Control-Request-Method", "GET")
                .exchange()
                .expectStatus()
                .isOk()
                .expectHeader()
                .valueEquals("Access-Control-Allow-Origin", "http://localhost:5173");
    }

    private static JwtMutator through(String client, String role) {
        return mockJwt().jwt(jwt -> jwt.claim("azp", client)).authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }
}
