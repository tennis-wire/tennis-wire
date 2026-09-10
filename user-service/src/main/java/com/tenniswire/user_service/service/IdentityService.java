package com.tenniswire.user_service.service;

import com.tenniswire.user_service.entity.IdentityLinkId;
import com.tenniswire.user_service.exception.SubjectAlreadyLinkedException;
import com.tenniswire.user_service.repository.IdentityLinkRepository;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class IdentityService {

    private static final int MAX_ATTEMPTS = 5;

    private final IdentityLinkRepository links;
    private final LinkedProfileWriter writer;

    public IdentityService(IdentityLinkRepository links, LinkedProfileWriter writer) {
        this.links = links;
        this.writer = writer;
    }

    public UUID resolve(String provider, String sub) {
        var id = new IdentityLinkId(provider, sub);

        for (var attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            var existing = links.findById(id);
            if (existing.isPresent()) {
                return existing.get().userId();
            }
            try {
                return writer.createFor(id);
            } catch (SubjectAlreadyLinkedException | DataIntegrityViolationException e) {
                log.debug("resolve attempt {} for {} lost a race: {}", attempt, provider, e.getMessage());
            }
        }
        throw new IllegalStateException(
                "could not resolve %s/%s after %d attempts".formatted(provider, sub, MAX_ATTEMPTS));
    }
}
