package com.tenniswire.discussion_service.controller.reader;

import com.tenniswire.discussion_service.client.AuthorProfile;
import com.tenniswire.discussion_service.dto.reader.BlockResponse;
import com.tenniswire.discussion_service.entity.Block;
import com.tenniswire.discussion_service.exception.UserNotFoundException;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class BlockResponses {

    private final AuthorResponses authors;

    public BlockResponses(AuthorResponses authors) {
        this.authors = authors;
    }

    // A whole page named with one lookup, as a comment listing is
    public List<BlockResponse> of(List<Block> blocks) {
        var people =
                authors.of(blocks.stream().map(block -> block.id().blockedId()).collect(Collectors.toSet()));
        return blocks.stream()
                .map(block -> BlockResponse.from(block, people.get(block.id().blockedId())))
                .toList();
    }

    public BlockResponse of(Block block) {
        return of(List.of(block)).getFirst();
    }

    // Asked before anything is written, as a comment's author is: a person user-service does not
    // know cannot be blocked
    public AuthorProfile targetBeforeWriting(UUID blockedId) {
        var profile = authors.profile(blockedId);
        if (profile == null) {
            throw new UserNotFoundException(blockedId);
        }
        return profile;
    }

    public BlockResponse written(Block block, AuthorProfile target) {
        return BlockResponse.from(block, authors.of(target));
    }
}
