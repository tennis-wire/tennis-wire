package com.tenniswire.user_service.service;

import com.tenniswire.user_service.client.ReaderTraceClient;
import com.tenniswire.user_service.exception.DiscussionServiceUnavailableException;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class ImmediateTraceErasure {

    private final ReaderTraceClient traces;

    public ImmediateTraceErasure(ReaderTraceClient traces) {
        this.traces = traces;
    }

    @Async
    public void start(UUID userId) {
        try {
            traces.erase(userId);
        } catch (DiscussionServiceUnavailableException e) {
            log.warn("the trace of {} is still there: {}", userId, e.getMessage());
        }
    }
}
