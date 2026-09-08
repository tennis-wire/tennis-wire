package com.tenniswire.discussion_service.event;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

@Component
public class SpringDomainEventPublisher implements DomainEventPublisher {

    private final ApplicationEventPublisher applicationEvents;

    public SpringDomainEventPublisher(ApplicationEventPublisher applicationEvents) {
        this.applicationEvents = applicationEvents;
    }

    @Override
    public void publish(CommentCreatedEvent event) {
        applicationEvents.publishEvent(event);
    }
}
