package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.entity.Comment;

/**
 * @param mutedByRecipient the author of the comment replied to has blocked this author: the reply
 *     is stored and visible to everyone else, but the client shows the "you are muted" notice
 */
public record CreatedComment(Comment comment, boolean mutedByRecipient) {}
