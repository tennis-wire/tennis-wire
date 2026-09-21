package com.tenniswire.user_service.service;

import com.tenniswire.user_service.client.AvatarStorage;
import com.tenniswire.user_service.exception.StorageUnavailableException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

// Row first, objects after: a row pointing at nothing is a broken picture on the site, an object
// nothing points at is only storage. What cannot be deleted is left behind.
@Component
@Slf4j
public class AvatarJanitor {

    private final AvatarStorage storage;

    public AvatarJanitor(AvatarStorage storage) {
        this.storage = storage;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void discarded(AvatarDiscarded event) {
        remove(event.avatarKey());
    }

    public void remove(String avatarKey) {
        for (var size : AvatarSize.values()) {
            var objectKey = size.objectKey(avatarKey);
            try {
                storage.delete(objectKey);
            } catch (StorageUnavailableException e) {
                log.warn("avatar object {} is left behind: {}", objectKey, e.getMessage());
            }
        }
    }
}
