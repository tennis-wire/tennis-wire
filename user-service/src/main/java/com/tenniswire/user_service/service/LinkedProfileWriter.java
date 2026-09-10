package com.tenniswire.user_service.service;

import com.tenniswire.user_service.entity.IdentityLinkId;
import com.tenniswire.user_service.entity.Profile;
import com.tenniswire.user_service.exception.SubjectAlreadyLinkedException;
import com.tenniswire.user_service.repository.IdentityLinkRepository;
import com.tenniswire.user_service.repository.ProfileRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class LinkedProfileWriter {

    private final ProfileRepository profiles;
    private final IdentityLinkRepository links;

    public LinkedProfileWriter(ProfileRepository profiles, IdentityLinkRepository links) {
        this.profiles = profiles;
        this.links = links;
    }

    public UUID createFor(IdentityLinkId id) {
        // saveAndFlush, not save: the insert below is native SQL and will not see a profile that is
        // still sitting in the persistence context, so the foreign key would fail.
        var profile = profiles.saveAndFlush(new Profile().displayName(DisplayNames.generateStub()));

        if (links.insertIfAbsent(id.provider(), id.sub(), profile.userId()) == 0) {
            // Zero rows is not an error to the driver, so nothing rolls back on its own. Ask for it
            // explicitly, or the profile above commits with no link pointing at it.
            throw new SubjectAlreadyLinkedException(id);
        }
        return profile.userId();
    }
}
