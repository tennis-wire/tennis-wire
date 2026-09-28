package com.tenniswire.user_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withResourceNotFound;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.tenniswire.user_service.client.KeycloakAdmin;
import com.tenniswire.user_service.exception.IdentityProviderUnavailableException;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class KeycloakAdminTest {

    private static final String BASE = "http://keycloak:8080";
    private static final String USERS = BASE + "/admin/realms/tennis-wire/users/sub-1";
    private static final String ACCOUNT =
            "{\"id\":\"sub-1\",\"username\":\"leaving@example.test\",\"email\":\"leaving@example.test\","
                    + "\"enabled\":true,\"firstName\":\"Given\",\"lastName\":\"Family\"}";

    private MockRestServiceServer keycloak;
    private KeycloakAdmin admin;

    @BeforeEach
    void bindToAMockedAdminApi() {
        var builder = RestClient.builder().baseUrl(BASE);
        keycloak = MockRestServiceServer.bindTo(builder).build();
        admin = new KeycloakAdmin(builder.build(), "tennis-wire");
    }

    @Test
    void whatIsWrittenBackCarriesTheAddressItReadRatherThanOnlyTheChanges() {
        keycloak.expect(requestTo(USERS))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(ACCOUNT, MediaType.APPLICATION_JSON));
        keycloak.expect(requestTo(USERS))
                .andExpect(method(HttpMethod.PUT))
                .andExpect(content()
                        .json("{\"username\":\"leaving@example.test\",\"email\":\"leaving@example.test\","
                                + "\"enabled\":false,\"firstName\":\"\",\"lastName\":\"\"}"))
                .andRespond(withSuccess());
        keycloak.expect(requestTo(USERS + "/logout"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess());
        keycloak.expect(requestTo(USERS + "/credentials"))
                .andRespond(withSuccess("[{\"id\":\"cred-1\",\"type\":\"password\"}]", MediaType.APPLICATION_JSON));
        keycloak.expect(requestTo(USERS + "/credentials/cred-1"))
                .andExpect(method(HttpMethod.DELETE))
                .andRespond(withSuccess());
        keycloak.expect(requestTo(USERS + "/federated-identity"))
                .andRespond(withSuccess("[{\"identityProvider\":\"google\"}]", MediaType.APPLICATION_JSON));
        keycloak.expect(requestTo(USERS + "/federated-identity/google"))
                .andExpect(method(HttpMethod.DELETE))
                .andRespond(withSuccess());

        admin.stripAndDisable("sub-1");

        keycloak.verify();
    }

    @Test
    void anAccountWithNothingOnItIsStrippedWithoutComplaint() {
        keycloak.expect(requestTo(USERS)).andRespond(withSuccess(ACCOUNT, MediaType.APPLICATION_JSON));
        keycloak.expect(requestTo(USERS)).andRespond(withSuccess());
        keycloak.expect(requestTo(USERS + "/logout")).andRespond(withSuccess());
        keycloak.expect(requestTo(USERS + "/credentials")).andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));
        keycloak.expect(requestTo(USERS + "/federated-identity"))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));

        admin.stripAndDisable("sub-1");

        keycloak.verify();
    }

    @Test
    void anAccountAlreadyGoneIsNotWrittenBackTo() {
        keycloak.expect(requestTo(USERS)).andExpect(method(HttpMethod.GET)).andRespond(withResourceNotFound());

        admin.stripAndDisable("sub-1");

        // nothing else was sent: there is nobody left to strip
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
    void groupsAreReadAsTheirFullPaths() {
        keycloak.expect(requestTo(USERS + "/groups"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(
                        "[{\"id\":\"g-1\",\"name\":\"authors\",\"path\":\"/staff/authors\"},"
                                + "{\"id\":\"g-2\",\"name\":\"moderators\",\"path\":\"/staff/moderators\"}]",
                        MediaType.APPLICATION_JSON));

        assertThat(admin.groupsOf("sub-1")).containsExactly("/staff/authors", "/staff/moderators");
    }

    @Test
    void aGroupWithoutAPathIsNotReadAsNoGroup() {
        keycloak.expect(requestTo(USERS + "/groups"))
                .andRespond(withSuccess("[{\"id\":\"g-1\",\"name\":\"authors\"}]", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> admin.groupsOf("sub-1")).isInstanceOf(IdentityProviderUnavailableException.class);
    }

    // Unlike everything taken away above, a missing account is not where anyone wanted to end up here
    @Test
    void groupsOfAnAccountThatIsNotThereAreARefusal() {
        keycloak.expect(requestTo(USERS + "/groups")).andRespond(withResourceNotFound());

        assertThatThrownBy(() -> admin.groupsOf("sub-1")).isInstanceOf(IdentityProviderUnavailableException.class);
    }

    @Test
    void groupsKeycloakWouldNotShowAreARefusal() {
        keycloak.expect(requestTo(USERS + "/groups")).andRespond(withStatus(HttpStatus.FORBIDDEN));

        assertThatThrownBy(() -> admin.groupsOf("sub-1")).isInstanceOf(IdentityProviderUnavailableException.class);
    }

    @Test
    void keycloakRefusingIsPassedOnRatherThanSwallowed() {
        keycloak.expect(requestTo(USERS)).andRespond(withServerError());

        assertThatThrownBy(() -> admin.stripAndDisable("sub-1"))
                .isInstanceOf(IdentityProviderUnavailableException.class);
    }
}
