package com.tenniswire.user_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.tenniswire.user_service.entity.IdentityLink;
import com.tenniswire.user_service.entity.IdentityLinkId;
import com.tenniswire.user_service.entity.Profile;
import com.tenniswire.user_service.repository.IdentityLinkRepository;
import com.tenniswire.user_service.repository.ProfileRepository;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class SchemaIT {

    @Autowired
    private ProfileRepository profiles;

    @Autowired
    private IdentityLinkRepository links;

    private Profile profileNamed(String displayName) {
        var profile = new Profile();
        profile.displayName(displayName);
        return profiles.saveAndFlush(profile);
    }

    @Test
    void theIdIsKnownBeforeTheInsertAndTheDatabaseFillsTheTimestamps() {
        var profile = new Profile();
        profile.displayName("reader-" + UUID.randomUUID());

        assertThat(profile.userId()).isNull();
        var saved = profiles.saveAndFlush(profile);

        assertThat(saved.userId()).isNotNull();
        assertThat(saved.createdAt()).isNotNull();
        assertThat(saved.updatedAt()).isNotNull();
        assertThat(saved.displayNameChosen()).isFalse();
    }

    @Test
    void displayNamesCollideRegardlessOfCase() {
        var name = "Reader-" + UUID.randomUUID();
        profileNamed(name);

        var clash = new Profile();
        clash.displayName(name.toUpperCase());

        assertThatThrownBy(() -> profiles.saveAndFlush(clash)).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void updatingAProfileMovesUpdatedAt() {
        var profile = profileNamed("reader-" + UUID.randomUUID());
        var createdAt = profile.createdAt();
        var updatedAt = profile.updatedAt();

        profile.displayName("chosen-" + UUID.randomUUID());
        profile.displayNameChosen(true);
        var updated = profiles.saveAndFlush(profile);

        assertThat(updated.updatedAt()).isAfter(updatedAt);
        assertThat(updated.createdAt()).isEqualTo(createdAt);
    }

    @Test
    void identityLinksAreFoundByUserIdAndDieWithTheProfile() {
        var profile = profileNamed("reader-" + UUID.randomUUID());
        var id = new IdentityLinkId("keycloak", UUID.randomUUID().toString());
        links.saveAndFlush(new IdentityLink(id, profile.userId()));

        assertThat(links.findByUserId(profile.userId())).singleElement().satisfies(link -> {
            assertThat(link.id().sub()).isEqualTo(id.sub());
            assertThat(link.createdAt()).isNotNull();
        });

        profiles.delete(profile);
        profiles.flush();

        assertThat(links.findById(id)).isEmpty();
    }
}
