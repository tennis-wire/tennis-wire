package com.tenniswire.discussion_service.controller.reader;

import com.tenniswire.discussion_service.dto.reader.ViewerResponse;
import com.tenniswire.discussion_service.service.RestrictionService;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

// The reader's own standing, for the two reads that open a thread: the listing and the chain a link
// leads to. With them it arrives together with the comments, and a form or a ban plate can be drawn
// at once rather than found out on sending.
@Component
public class ViewerResponses {

    private final RestrictionService restrictions;

    public ViewerResponses(RestrictionService restrictions) {
        this.restrictions = restrictions;
    }

    // Nothing for someone not signed in: there is nobody to stop
    public @Nullable ViewerResponse of(@Nullable UUID viewerId) {
        if (viewerId == null) {
            return null;
        }
        // The first active restriction binds: one with no end ahead of any, then the latest end
        var restriction = restrictions.activeFor(viewerId).stream()
                .findFirst()
                .map(binding -> new ViewerResponse.Restriction(binding.expiresAt()))
                .orElse(null);
        return new ViewerResponse(restriction);
    }
}
