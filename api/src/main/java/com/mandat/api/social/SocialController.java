package com.mandat.api.social;

import com.mandat.api.common.config.OpenApiConfig;
import com.mandat.api.common.security.AuthenticatedUser;
import com.mandat.api.social.dto.SocialDtos.AddFriendRequest;
import com.mandat.api.social.dto.SocialDtos.AddFriendResponse;
import com.mandat.api.social.dto.SocialDtos.FriendsResponse;
import com.mandat.api.social.dto.SocialDtos.ReportRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
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

    public SocialController(FriendService friends, ReportService reports) {
        this.friends = friends;
        this.reports = reports;
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
}
