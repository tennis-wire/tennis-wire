package com.tenniswire.discussion_service.exception;

import java.util.List;
import java.util.UUID;

// The comment exists, but the viewer's subtree_removal on its author or on the author of a comment
// above it hides it. blockedIds: those authors, nearest the root first
public class HiddenByBlockException extends RuntimeException {

    private final List<UUID> blockedIds;

    public HiddenByBlockException(UUID commentId, List<UUID> blockedIds) {
        super("Comment " + commentId + " is in a branch the viewer's own block removes");
        this.blockedIds = List.copyOf(blockedIds);
    }

    public List<UUID> blockedIds() {
        return blockedIds;
    }
}
