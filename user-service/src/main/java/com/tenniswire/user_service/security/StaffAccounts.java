package com.tenniswire.user_service.security;

import com.tenniswire.user_service.client.KeycloakAdmin;
import com.tenniswire.user_service.exception.StaffAccountException;
import java.util.List;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

// Staff accounts are only ever disabled: the sub owns articles and signs revisions, and deleting the
// account would take it away for good. Groups are used here to refuse and never to let anyone in.
@Component
public class StaffAccounts {

    private static final String GROUPS = "groups";
    private static final String STAFF = "/staff/";

    private final KeycloakAdmin keycloak;

    public StaffAccounts(KeycloakAdmin keycloak) {
        this.keycloak = keycloak;
    }

    // Only the site and the app map groups into their tokens, and Keycloak leaves the claim out for
    // an account in no group at all. Without it nothing says this is a reader, so it is refused;
    // an empty list is a reader in no group and passes.
    public void refuseCaller(Jwt jwt) {
        if (!(jwt.getClaims().get(GROUPS) instanceof List<?> groups)
                || groups.stream().anyMatch(group -> !(group instanceof String path) || path.startsWith(STAFF))) {
            throw new StaffAccountException();
        }
    }

    // Asked of Keycloak and not of the caller's token: the account is someone else's. Keycloak not
    // answering, or not knowing the account, is raised as it is and stops the deletion.
    public void refuseTarget(String subject) {
        if (keycloak.groupsOf(subject).stream().anyMatch(path -> path.startsWith(STAFF))) {
            throw new StaffAccountException();
        }
    }
}
