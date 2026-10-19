package com.mandat.api.economy;

import com.mandat.api.common.config.OpenApiConfig;
import com.mandat.api.common.security.AuthenticatedUser;
import com.mandat.api.economy.dto.EconomyDtos.CraftAllowanceDto;
import com.mandat.api.economy.dto.EconomyDtos.DailyCapDto;
import com.mandat.api.economy.dto.EconomyDtos.LimitsResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/limits")
@Tag(name = "Collection")
@SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
public class LimitsController {

    private final DailyRewardLimits daily;
    private final CraftAllowanceService crafts;
    private final Clock clock;

    public LimitsController(DailyRewardLimits daily, CraftAllowanceService crafts, Clock clock) {
        this.daily = daily;
        this.crafts = crafts;
        this.clock = clock;
    }

    @GetMapping
    @Operation(summary = "Rewards left today (quizzes, duel wins) and the crafting allowance")
    @Transactional(readOnly = true)
    public LimitsResponse limits(@AuthenticationPrincipal AuthenticatedUser user) {
        UUID userId = user.id();
        Instant now = clock.instant();
        int quizUsed = daily.quizRewardsUsed(userId, now);
        int duelUsed = daily.duelWinRewardsUsed(userId, now);
        CraftAllowanceService.Allowance allowance = crafts.allowance(userId, now);
        return new LimitsResponse(
                cap(RewardLimits.QUIZ_REWARDS_PER_DAY, quizUsed),
                cap(RewardLimits.DUEL_WIN_REWARDS_PER_DAY, duelUsed),
                new CraftAllowanceDto(allowance.available(), allowance.max(), allowance.intervalHours(), allowance.nextAt()),
                daily.resetsAt(userId, now));
    }

    private static DailyCapDto cap(int perDay, int used) {
        return new DailyCapDto(perDay, Math.min(used, perDay), Math.max(0, perDay - used));
    }
}
