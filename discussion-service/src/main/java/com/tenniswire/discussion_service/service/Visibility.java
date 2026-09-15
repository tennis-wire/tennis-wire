package com.tenniswire.discussion_service.service;

/** What the viewer gets for a node after soft-delete and block rules are applied. */
public enum Visibility {
    VISIBLE("visible"),
    /** Body and author are returned but the client renders the comment collapsed with an "expand" control. */
    SOFT_HIDDEN("soft_hidden"),
    /** "Comment hidden": body and author withheld, replies shown. */
    GRAVESTONE("gravestone"),
    /** Taken down by its author: body and author withheld, replies shown. */
    DELETED("deleted"),
    /**
     * Taken down by moderation. The same placeholder as a deletion, told apart so the client can
     * say which it was (discussion-rules §11.8); the author gets no other view of it than anyone
     * else (§11.12).
     */
    REMOVED("removed");

    private final String value;

    Visibility(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    // Whether the author is sent. A collapsed comment keeps it: expanding one shows the name, and the
    // viewer who collapsed it already knows whose it is.
    public boolean showsAuthor() {
        return this == VISIBLE || this == SOFT_HIDDEN;
    }
}
