package com.tenniswire.api_gateway;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.reactive.server.SecurityMockServerConfigurers.mockJwt;
import static org.springframework.security.test.web.reactive.server.SecurityMockServerConfigurers.springSecurity;

import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.reactive.server.WebTestClient;

@SpringBootTest
class GatewayAuthorizationTest {

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
        client.mutateWith(mockJwt().authorities(new SimpleGrantedAuthority("ROLE_author")))
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
}
