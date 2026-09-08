package com.tenniswire.discussion_service.controller;

import com.tenniswire.discussion_service.dto.BlockRequest;
import com.tenniswire.discussion_service.dto.BlockResponse;
import com.tenniswire.discussion_service.entity.BlockMode;
import com.tenniswire.discussion_service.security.CurrentUser;
import com.tenniswire.discussion_service.service.BlockService;
import jakarta.validation.Valid;
import java.util.List;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The caller's own block list. The blocker is always the token holder; the blocked user is the path. */
@RestController
@RequestMapping("/api/discussion/blocks")
public class BlockController {

    private final BlockService blockService;
    private final CurrentUser currentUser;

    public BlockController(BlockService blockService, CurrentUser currentUser) {
        this.blockService = blockService;
        this.currentUser = currentUser;
    }

    @GetMapping
    public List<BlockResponse> list(@AuthenticationPrincipal Jwt jwt) {
        return BlockResponse.from(blockService.list(currentUser.id(jwt)));
    }

    /** Create, or change the mode of, a block. PUT because the pair is the identity. */
    @PutMapping("/{blockedId}")
    public BlockResponse block(
            @PathVariable UUID blockedId, @Valid @RequestBody BlockRequest request, @AuthenticationPrincipal Jwt jwt) {
        var mode = BlockMode.fromValue(request.mode());
        return BlockResponse.from(blockService.block(currentUser.id(jwt), blockedId, mode));
    }

    @DeleteMapping("/{blockedId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unblock(@PathVariable UUID blockedId, @AuthenticationPrincipal Jwt jwt) {
        blockService.unblock(currentUser.id(jwt), blockedId);
    }
}
