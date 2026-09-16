package com.tenniswire.discussion_service.controller.reader;

import com.tenniswire.discussion_service.dto.reader.BlockPageResponse;
import com.tenniswire.discussion_service.dto.reader.BlockRequest;
import com.tenniswire.discussion_service.dto.reader.BlockResponse;
import com.tenniswire.discussion_service.entity.BlockMode;
import com.tenniswire.discussion_service.security.CurrentUser;
import com.tenniswire.discussion_service.service.BlockService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The caller's own block list. The blocker is always the token holder; the blocked user is the path. */
@RestController
@RequestMapping("/api/discussion/blocks")
public class BlockController {

    private final BlockService blockService;
    private final CurrentUser currentUser;
    private final BlockResponses responses;

    public BlockController(BlockService blockService, CurrentUser currentUser, BlockResponses responses) {
        this.blockService = blockService;
        this.currentUser = currentUser;
        this.responses = responses;
    }

    @GetMapping
    public BlockPageResponse list(
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String cursor,
            @AuthenticationPrincipal Jwt jwt) {
        var page = blockService.page(currentUser.id(jwt), limit, cursor);
        return new BlockPageResponse(responses.of(page.items()), page.nextCursor());
    }

    // One row, for a page that met the reader's own block and offers to change it on the spot
    @GetMapping("/{blockedId}")
    public BlockResponse one(@PathVariable UUID blockedId, @AuthenticationPrincipal Jwt jwt) {
        return responses.of(blockService.one(currentUser.id(jwt), blockedId));
    }

    /** Create, or change the mode of, a block. PUT because the pair is the identity. */
    @PutMapping("/{blockedId}")
    public BlockResponse block(
            @PathVariable UUID blockedId, @Valid @RequestBody BlockRequest request, @AuthenticationPrincipal Jwt jwt) {
        var blockerId = currentUser.id(jwt);
        var mode = BlockMode.fromValue(request.mode());
        var target = responses.targetBeforeWriting(blockedId);
        return responses.written(blockService.block(blockerId, blockedId, mode), target);
    }

    @DeleteMapping("/{blockedId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unblock(@PathVariable UUID blockedId, @AuthenticationPrincipal Jwt jwt) {
        blockService.unblock(currentUser.id(jwt), blockedId);
    }
}
