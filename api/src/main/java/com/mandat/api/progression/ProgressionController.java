package com.mandat.api.progression;

import com.mandat.api.common.config.OpenApiConfig;
import com.mandat.api.common.security.AuthenticatedUser;
import com.mandat.api.common.wallet.WalletService;
import com.mandat.api.progression.RewardDto.UnlockDto;
import com.mandat.api.progression.level.XpCurve;
import com.mandat.api.progression.level.XpService;
import com.mandat.api.progression.streak.StreakRules;
import com.mandat.api.progression.streak.StreakRules.State;
import com.mandat.api.progression.streak.StreakService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/progression")
@Tag(name = "Progression", description = "Level, XP, streak and wallet summary")
@SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
public class ProgressionController {

    private final XpService xp;
    private final XpCurve curve;
    private final ProgressRepository progress;
    private final PlayerCalendar calendar;
    private final WalletService wallet;
    private final Clock clock;

    public ProgressionController(
            XpService xp,
            XpCurve curve,
            ProgressRepository progress,
            PlayerCalendar calendar,
            WalletService wallet,
            Clock clock) {
        this.xp = xp;
        this.curve = curve;
        this.progress = progress;
        this.calendar = calendar;
        this.wallet = wallet;
        this.clock = clock;
    }

    @GetMapping
    @Transactional
    @Operation(operationId = "getProgression", summary = "Level, XP, streak, resets and wallet of the player")
    public ProgressionResponse getProgression(@AuthenticationPrincipal AuthenticatedUser user) {
        UUID userId = user.id();
        Instant now = Instant.now(clock);
        xp.ensure(userId);
        PlayerProgress row = progress.find(userId).orElseThrow();
        ZoneId zone = calendar.zoneOf(userId);
        LocalDate today = PlayerCalendar.localDate(now, zone);
        State streak = StreakService.stateOf(row);
        boolean maxLevel = row.level() >= curve.maxLevel();
        WalletService.Balance balance = wallet.balance(userId);
        return new ProgressionResponse(
                row.level(),
                row.totalXp(),
                row.totalXp() - curve.totalXpForLevel(row.level()),
                maxLevel ? null : curve.xpToAdvance(row.level()),
                row.seasonXp(),
                StreakRules.effectiveStreak(streak, today),
                row.bestStreak(),
                StreakRules.activeToday(streak, today),
                StreakRules.freezeAvailableFor(streak, today),
                zone.getId(),
                PlayerCalendar.nextDailyReset(now, zone),
                PlayerCalendar.nextWeeklyReset(now, zone),
                balance.influence(),
                balance.bonusPacks(),
                progress.unlocks(userId).stream().map(u -> new UnlockDto(u.kind().name(), u.itemId())).toList());
    }

    public record ProgressionResponse(
            int level,
            int totalXp,
            @Schema(description = "XP earned since the current level was reached") int xpIntoLevel,
            @Schema(types = {"integer", "null"}, description = "XP needed for the next level, null at max level")
                    Integer xpForNextLevel,
            int seasonXp,
            @Schema(description = "Streak as of today (0 when broken)") int currentStreak,
            int bestStreak,
            @Schema(description = "A streak activity was already done today") boolean streakActiveToday,
            @Schema(description = "This week's free streak freeze is unused") boolean freezeAvailable,
            String timezone,
            Instant dailyResetAt,
            Instant weeklyResetAt,
            int influence,
            int bonusPacks,
            List<UnlockDto> unlocks) {}
}
