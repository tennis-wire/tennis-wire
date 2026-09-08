package com.tenniswire.discussion_service.dto;

import com.tenniswire.discussion_service.service.CommentView;
import com.tenniswire.discussion_service.service.CreatedComment;
import com.tenniswire.discussion_service.service.Visibility;
import java.util.List;

/** @param mutedByRecipient show the "you are muted, they will not see this" notice */
public record CommentCreatedResponse(CommentResponse comment, boolean mutedByRecipient) {

    public static CommentCreatedResponse from(CreatedComment created) {
        var view = new CommentView(created.comment(), Visibility.VISIBLE, List.of());
        return new CommentCreatedResponse(CommentResponse.from(view), created.mutedByRecipient());
    }
}
