package com.tenniswire.user_service.service;

import com.tenniswire.user_service.client.AvatarStorage;
import com.tenniswire.user_service.entity.Profile;
import com.tenniswire.user_service.exception.AvatarChangedException;
import com.tenniswire.user_service.exception.ResourceNotFoundException;
import com.tenniswire.user_service.exception.StorageUnavailableException;
import com.tenniswire.user_service.repository.ProfileRepository;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

// Not transactional as a whole: decoding and the bucket are the slow parts, and no connection is
// held open across them. Only the swap of the key is.
@Service
public class AvatarService {

    private static final int KEY_RANDOM_BYTES = 16;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final AvatarImages images;
    private final AvatarStorage storage;
    private final AvatarJanitor janitor;
    private final ProfileRepository profiles;
    private final ApplicationEventPublisher events;
    private final TransactionTemplate transactions;

    public AvatarService(
            AvatarImages images,
            AvatarStorage storage,
            AvatarJanitor janitor,
            ProfileRepository profiles,
            ApplicationEventPublisher events,
            TransactionTemplate transactions) {
        this.images = images;
        this.storage = storage;
        this.janitor = janitor;
        this.profiles = profiles;
        this.events = events;
        this.transactions = transactions;
    }

    public void set(UUID userId, byte[] upload) {
        var rendered = images.render(upload);
        var avatarKey = newKey(userId);
        store(avatarKey, rendered);
        try {
            transactions.executeWithoutResult(status -> replace(userId, avatarKey, null));
        } catch (RuntimeException e) {
            janitor.remove(avatarKey);
            throw e;
        }
    }

    public void remove(UUID userId) {
        transactions.executeWithoutResult(status -> replace(userId, null, null));
    }

    // seen: the key the moderator was looking at. A different avatar in its place is not his to
    // take down; none at all is already what he wanted.
    public void takeDown(UUID userId, @Nullable String seen) {
        transactions.executeWithoutResult(status -> replace(userId, null, seen));
    }

    public List<Profile> queue(int size) {
        return profiles.avatarsToReview(size);
    }

    public void review(UUID userId, String seen) {
        var marked = transactions.execute(status -> profiles.markAvatarReviewed(userId, seen));
        if (marked == null || marked == 0) {
            if (!profiles.existsById(userId)) {
                throw new ResourceNotFoundException("profile", userId);
            }
            throw new AvatarChangedException();
        }
    }

    // Under the row lock: two uploads at once each discard exactly the key the other one replaced
    private void replace(UUID userId, @Nullable String avatarKey, @Nullable String seen) {
        var previous = profiles.lock(userId)
                .orElseThrow(() -> new ResourceNotFoundException("profile", userId))
                .avatarKey();
        if (seen != null && previous != null && !seen.equals(previous)) {
            throw new AvatarChangedException();
        }
        if (previous == null && avatarKey == null) {
            return;
        }
        profiles.setAvatar(userId, avatarKey);
        if (previous != null) {
            events.publishEvent(new AvatarDiscarded(previous));
        }
    }

    private void store(String avatarKey, Map<AvatarSize, byte[]> rendered) {
        try {
            for (var entry : rendered.entrySet()) {
                storage.put(entry.getKey().objectKey(avatarKey), entry.getValue());
            }
        } catch (StorageUnavailableException e) {
            janitor.remove(avatarKey);
            throw e;
        }
    }

    // Never reused, which is what lets the objects be cached for good
    private static String newKey(UUID userId) {
        var bytes = new byte[KEY_RANDOM_BYTES];
        RANDOM.nextBytes(bytes);
        return userId + "/" + HexFormat.of().formatHex(bytes) + ".jpg";
    }
}
