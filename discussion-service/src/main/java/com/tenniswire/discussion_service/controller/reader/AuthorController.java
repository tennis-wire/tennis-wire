package com.tenniswire.discussion_service.controller.reader;

import com.tenniswire.discussion_service.dto.reader.AuthorCardResponse;
import com.tenniswire.discussion_service.exception.ResourceNotFoundException;
import com.tenniswire.discussion_service.service.CommentService;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/discussion/authors")
public class AuthorController {

    private final AuthorResponses authors;
    private final CommentService commentService;

    public AuthorController(AuthorResponses authors, CommentService commentService) {
        this.authors = authors;
        this.commentService = commentService;
    }

    // What a reader's public page shows about him. Under a commenting restriction it is a 404, the
    // same as for an id nobody has: a thread does not name him, and his page does not exist.
    @GetMapping("/{authorId}")
    public AuthorCardResponse card(@PathVariable UUID authorId) {
        var author = authors.named(authorId);
        if (author == null) {
            throw new ResourceNotFoundException("Author", authorId);
        }
        return new AuthorCardResponse(
                author.id(), author.displayName(), author.avatarUrl(), commentService.countByAuthor(authorId));
    }
}
