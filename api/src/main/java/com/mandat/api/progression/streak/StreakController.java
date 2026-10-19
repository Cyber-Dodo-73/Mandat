package com.mandat.api.progression.streak;

import com.mandat.api.common.config.OpenApiConfig;
import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import com.mandat.api.common.security.AuthenticatedUser;
import com.mandat.api.progression.streak.StreakDtos.FriendStreaksResponse;
import com.mandat.api.progression.streak.StreakDtos.InviteFriendStreakRequest;
import com.mandat.api.progression.streak.StreakDtos.NudgeResponse;
import com.mandat.api.progression.streak.StreakDtos.PurchaseFreezeRequest;
import com.mandat.api.progression.streak.StreakDtos.PurchaseFreezeResponse;
import com.mandat.api.progression.streak.StreakDtos.StreakHistoryResponse;
import com.mandat.api.progression.streak.StreakDtos.StreakResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Streaks", description = "Daily streak, freezes, repair, friend streaks and nudges")
@SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
public class StreakController {

    private static final int MAX_IDEMPOTENCY_KEY = 128;

    private final StreakService streaks;
    private final FriendStreakService friendStreaks;
    private final NudgeService nudges;

    public StreakController(StreakService streaks, FriendStreakService friendStreaks, NudgeService nudges) {
        this.streaks = streaks;
        this.friendStreaks = friendStreaks;
        this.nudges = nudges;
    }

    @GetMapping("/streak")
    @Operation(operationId = "getStreak", summary = "Streak, freezes, milestones and repair offer")
    public StreakResponse streak(@AuthenticationPrincipal AuthenticatedUser user) {
        return streaks.view(user.id());
    }

    @GetMapping("/streak/history")
    @Operation(operationId = "getStreakHistory", summary = "Calendar of the last days (active, frozen, missed)")
    public StreakHistoryResponse history(@AuthenticationPrincipal AuthenticatedUser user,
            @Parameter(description = "Number of days, up to 120") @RequestParam(defaultValue = "60") int days) {
        return streaks.history(user.id(), days);
    }

    @PostMapping("/streak/repair")
    @Operation(operationId = "repairStreak", summary = "Repair a streak lost in the last 24 h (once per month)")
    public StreakResponse repair(@AuthenticationPrincipal AuthenticatedUser user) {
        return streaks.repair(user.id());
    }

    @PostMapping("/streak/freezes/purchase")
    @Operation(operationId = "purchaseStreakFreeze",
            summary = "Buy a streak freeze (Influence today; Sceaux once the premium currency exists)")
    public PurchaseFreezeResponse purchaseFreeze(@AuthenticationPrincipal AuthenticatedUser user,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody PurchaseFreezeRequest request) {
        if (idempotencyKey == null || idempotencyKey.isBlank() || idempotencyKey.length() > MAX_IDEMPOTENCY_KEY) {
            throw new ApiException(ErrorCode.IDEMPOTENCY_KEY_REQUIRED, "Idempotency-Key header required (max 128 chars)");
        }
        return streaks.purchaseFreeze(user.id(), request.currency(), idempotencyKey);
    }

    @GetMapping("/friend-streaks")
    @Operation(operationId = "getFriendStreaks", summary = "Friend streaks and invitations")
    public FriendStreaksResponse friendStreaks(@AuthenticationPrincipal AuthenticatedUser user) {
        return friendStreaks.list(user.id());
    }

    @PostMapping("/friend-streaks")
    @Operation(operationId = "inviteFriendStreak", summary = "Invite a friend to a friend streak (accepts theirs if they invited first)")
    public FriendStreaksResponse invite(@AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody InviteFriendStreakRequest request) {
        return friendStreaks.invite(user.id(), request.friendCode());
    }

    @PostMapping("/friend-streaks/{id}/accept")
    @Operation(operationId = "acceptFriendStreak", summary = "Accept a friend streak invitation")
    public FriendStreaksResponse accept(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        return friendStreaks.accept(user.id(), id);
    }

    @PostMapping("/friend-streaks/{id}/decline")
    @Operation(operationId = "declineFriendStreak", summary = "Decline a friend streak invitation")
    public FriendStreaksResponse decline(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        return friendStreaks.remove(user.id(), id);
    }

    @DeleteMapping("/friend-streaks/{id}")
    @Operation(operationId = "removeFriendStreak", summary = "End a friend streak or cancel an invitation")
    public FriendStreaksResponse remove(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        return friendStreaks.remove(user.id(), id);
    }

    @PostMapping("/friends/{friendCode}/nudge")
    @Operation(operationId = "nudgeFriend", summary = "Nudge a friend who hasn't kept their streak today")
    public NudgeResponse nudge(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String friendCode) {
        return nudges.nudge(user.id(), friendCode);
    }
}
