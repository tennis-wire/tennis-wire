package com.tenniswire.user_service.service;

import com.tenniswire.user_service.entity.Profile;
import com.tenniswire.user_service.exception.DisplayNameTakenException;
import com.tenniswire.user_service.exception.InvalidDisplayNameException;
import com.tenniswire.user_service.exception.ResourceNotFoundException;
import com.tenniswire.user_service.repository.ProfileRepository;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ProfileService {

    public static final int MAX_LOOKUP_IDS = 200;

    private final ProfileRepository profiles;

    public ProfileService(ProfileRepository profiles) {
        this.profiles = profiles;
    }

    @Transactional(readOnly = true)
    public Profile byId(UUID userId) {
        return profiles.findById(userId).orElseThrow(() -> new ResourceNotFoundException("profile", userId));
    }

    public Profile rename(UUID userId, String displayName) {
        if (!DisplayNames.isValid(displayName)) {
            throw new InvalidDisplayNameException(displayName);
        }
        var profile = profiles.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("profile", userId))
                .displayName(displayName)
                .displayNameChosen(true);
        try {
            return profiles.saveAndFlush(profile);
        } catch (DataIntegrityViolationException e) {
            throw new DisplayNameTakenException(displayName);
        }
    }

    @Transactional(readOnly = true)
    public List<Profile> lookup(Collection<UUID> userIds) {
        if (userIds.size() > MAX_LOOKUP_IDS) {
            throw new IllegalArgumentException(
                    "at most %d ids per lookup, got %d".formatted(MAX_LOOKUP_IDS, userIds.size()));
        }
        return profiles.findAllById(userIds);
    }
}
