package com.tenniswire.discussion_service.event;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Stand-in consumer until the queue exists. AFTER_COMMIT is the contract a real publisher must
 * keep as well: an event for a comment that was rolled back must never leave the service.
 */
@Slf4j
@Component
public class CommentEventLogger {

    @TransactionalEventListener
    public void onCommentCreated(CommentCreatedEvent event) {
        log.info(
                "{} comment={} subject={}/{} root={} author={}",
                CommentCreatedEvent.TYPE,
                event.commentId(),
                event.subjectType(),
                event.subjectId(),
                event.rootId(),
                event.authorId());
    }
}
