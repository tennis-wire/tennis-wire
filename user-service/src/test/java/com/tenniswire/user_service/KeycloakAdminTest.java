package com.tenniswire.user_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withResourceNotFound;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.tenniswire.user_service.client.KeycloakAdmin;
import com.tenniswire.user_service.exception.IdentityProviderUnavailableException;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class KeycloakAdminTest {

    private static final String BASE = "http://keycloak:8080";
    private static final String USERS = BASE + "/admin/realms/tennis-wire/users/sub-1";

    private MockRestServiceServer keycloak;
    private KeycloakAdmin admin;

    @BeforeEach
    void bindToAMockedAdminApi() {
        var builder = RestClient.builder().baseUrl(BASE);
        keycloak = MockRestServiceServer.bindTo(builder).build();
        admin = new KeycloakAdmin(builder.build(), "tennis-wire");
    }

    @Test
    void strippingLeavesTheAddressAndTakesEverythingElse() {
        keycloak.expect(requestTo(USERS))
                .andExpect(method(HttpMethod.PUT))
                .andExpect(content().json("{\"enabled\":false,\"firstName\":\"\",\"lastName\":\"\",\"attributes\":{}}"))
                .andRespond(withSuccess());
        keycloak.expect(requestTo(USERS + "/logout"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess());
        keycloak.expect(requestTo(USERS + "/credentials"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("[{\"id\":\"cred-1\",\"type\":\"password\"}]", MediaType.APPLICATION_JSON));
        keycloak.expect(requestTo(USERS + "/credentials/cred-1"))
                .andExpect(method(HttpMethod.DELETE))
                .andRespond(withSuccess());
        keycloak.expect(requestTo(USERS + "/federated-identity"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("[{\"identityProvider\":\"google\"}]", MediaType.APPLICATION_JSON));
        keycloak.expect(requestTo(USERS + "/federated-identity/google"))
                .andExpect(method(HttpMethod.DELETE))
                .andRespond(withSuccess());

        admin.stripAndDisable("sub-1");

        keycloak.verify();
    }

    @Test
    void anAccountWithNothingOnItIsStrippedWithoutComplaint() {
        keycloak.expect(requestTo(USERS)).andRespond(withSuccess());
        keycloak.expect(requestTo(USERS + "/logout")).andRespond(withSuccess());
        keycloak.expect(requestTo(USERS + "/credentials")).andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));
        keycloak.expect(requestTo(USERS + "/federated-identity"))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));

        admin.stripAndDisable("sub-1");

        keycloak.verify();
    }

    @Test
    void anAccountAlreadyGoneIsWhereDeletingWantedToEndUp() {
        keycloak.expect(requestTo(USERS)).andExpect(method(HttpMethod.DELETE)).andRespond(withResourceNotFound());

        admin.delete("sub-1");

        keycloak.verify();
    }

    @Test
    void theLifespanToOutwaitComesFromTheRealm() {
        keycloak.expect(requestTo(BASE + "/admin/realms/tennis-wire"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(
                        "{\"realm\":\"tennis-wire\",\"accessTokenLifespan\":300}", MediaType.APPLICATION_JSON));

        assertThat(admin.accessTokenLifespan()).isEqualTo(Duration.ofMinutes(5));
    }

    @Test
    void aRealmThatNamesNoLifespanIsNotGuessedAt() {
        keycloak.expect(requestTo(BASE + "/admin/realms/tennis-wire"))
                .andRespond(withSuccess("{\"realm\":\"tennis-wire\"}", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> admin.accessTokenLifespan()).isInstanceOf(IdentityProviderUnavailableException.class);
    }

    @Test
    void keycloakRefusingIsPassedOnRatherThanSwallowed() {
        keycloak.expect(requestTo(USERS)).andRespond(withServerError());

        assertThatThrownBy(() -> admin.stripAndDisable("sub-1"))
                .isInstanceOf(IdentityProviderUnavailableException.class);
    }
}
