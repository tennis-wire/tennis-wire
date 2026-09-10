package com.tenniswire.user_service.exception;

import com.tenniswire.user_service.entity.IdentityLinkId;

public class SubjectAlreadyLinkedException extends RuntimeException {

    public SubjectAlreadyLinkedException(IdentityLinkId id) {
        super("subject already linked: " + id.provider() + "/" + id.sub());
    }
}
