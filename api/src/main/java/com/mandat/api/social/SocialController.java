package com.mandat.api.social;

import com.mandat.api.common.config.OpenApiConfig;
import com.mandat.api.common.security.AuthenticatedUser;
import com.mandat.api.social.dto.SocialDtos.AddFriendRequest;
import com.mandat.api.social.dto.SocialDtos.AddFriendResponse;
import com.mandat.api.social.dto.SocialDtos.BlockRequest;
import com.mandat.api.social.dto.SocialDtos.BlockedPlayerDto;
import com.mandat.api.social.dto.SocialDtos.FriendsResponse;
import com.mandat.api.social.dto.SocialDtos.ReportRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Social")
@SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
public class SocialController {

    private final FriendService friends;
    private final ReportService reports;
    private final BlockService blocks;

    public SocialController(FriendService friends, ReportService reports, BlockService blocks) {
        this.friends = friends;
        this.reports = reports;
        this.blocks = blocks;
    }

    @GetMapping("/friends")
    @Operation(summary = "Friends, received requests and sent requests")
    public FriendsResponse friends(@AuthenticationPrincipal AuthenticatedUser user) {
        return friends.list(user.id());
    }

    @PostMapping("/friends")
    @Operation(summary = "Add a friend by friend code: sends a request, or accepts theirs if they asked first")
    public AddFriendResponse addFriend(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody AddFriendRequest request) {
        return friends.add(user.id(), request.friendCode());
    }

    @PostMapping("/friends/{friendCode}/accept")
    @Operation(summary = "Accept a friend request received from this player")
    public FriendsResponse accept(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String friendCode) {
        return friends.accept(user.id(), friendCode);
    }

    @DeleteMapping("/friends/{friendCode}")
    @Operation(summary = "Remove a friend, cancel a sent request or decline a received one")
    public FriendsResponse remove(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String friendCode) {
        return friends.remove(user.id(), friendCode);
    }

    @PostMapping("/reports")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Report a profile to the moderators (rate-limited, never shown publicly)")
    public void report(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody ReportRequest request) {
        reports.report(user.id(), request);
    }

    @GetMapping("/blocks")
    @Operation(operationId = "listBlocks", summary = "Players I blocked")
    public List<BlockedPlayerDto> blocks(@AuthenticationPrincipal AuthenticatedUser user) {
        return blocks.list(user.id());
    }

    @PostMapping("/blocks")
    @Operation(operationId = "blockPlayer",
            summary = "Block a player: ends the friendship; neither side can see or contact the other")
    public List<BlockedPlayerDto> block(@AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody BlockRequest request) {
        return blocks.block(user.id(), request.friendCode());
    }

    @DeleteMapping("/blocks/{friendCode}")
    @Operation(operationId = "unblockPlayer", summary = "Unblock a player")
    public List<BlockedPlayerDto> unblock(@AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable String friendCode) {
        return blocks.unblock(user.id(), friendCode);
    }
}
