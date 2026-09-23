package com.tenniswire.content_service.exception;

import java.util.Collection;
import java.util.UUID;

public class UnknownTagException extends RuntimeException {

    public UnknownTagException(Collection<UUID> ids) {
        super("Unknown tags: " + ids);
    }
}
