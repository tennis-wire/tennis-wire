package com.tenniswire.discussion_service.service;

/** What the viewer gets for a node after soft-delete and block rules are applied. */
public enum Visibility {
    VISIBLE("visible"),
    /** Body is returned but the client renders it collapsed with an "expand" control. */
    SOFT_HIDDEN("soft_hidden"),
    /** "Comment hidden": body withheld, replies shown. */
    GRAVESTONE("gravestone"),
    /** Soft-deleted: body and author withheld, replies shown. */
    DELETED("deleted");

    private final String value;

    Visibility(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }
}
