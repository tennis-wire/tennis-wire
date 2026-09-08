package com.tenniswire.discussion_service.event;

/**
 * The seam between the write path and the queue. The queue itself is not chosen yet (there is no
 * broker in the local stack), so the only implementation forwards to Spring's in-process event
 * bus; a broker-backed one replaces it without touching the services.
 */
public interface DomainEventPublisher {

    void publish(CommentCreatedEvent event);
}
