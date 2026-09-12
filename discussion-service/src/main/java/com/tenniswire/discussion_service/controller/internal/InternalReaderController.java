package com.tenniswire.discussion_service.controller.internal;

import com.tenniswire.discussion_service.dto.internal.ErasedReaderResponse;
import com.tenniswire.discussion_service.service.ReaderErasure;
import java.util.UUID;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// Reached over cluster DNS by user-service alone; never routed through the gateway
@RestController
@RequestMapping("/internal")
public class InternalReaderController {

    private final ReaderErasure erasure;

    public InternalReaderController(ReaderErasure erasure) {
        this.erasure = erasure;
    }

    // Answers with a body rather than 204: the ban it reports is what user-service waits on before
    // deleting the account itself.
    @DeleteMapping("/users/{readerId}")
    public ErasedReaderResponse erase(@PathVariable UUID readerId) {
        var erased = erasure.erase(readerId);
        return new ErasedReaderResponse(erased.banned(), erased.bannedUntil());
    }
}
