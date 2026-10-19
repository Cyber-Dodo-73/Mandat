package com.mandat.api.progression;

import com.mandat.api.common.wallet.WalletService;
import com.mandat.api.progression.RewardDto.UnlockDto;
import com.mandat.api.progression.level.XpCurve;
import com.mandat.api.progression.level.XpService;
import com.mandat.api.progression.streak.StreakRules;
import com.mandat.api.progression.streak.StreakRules.State;
import com.mandat.api.progression.streak.StreakService;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Player progression summary, served by GET /progression and contributed to GET /me. */
@Service
public class ProgressionSummaryService {

    private final XpService xp;
    private final XpCurve curve;
    private final ProgressRepository progress;
    private final PlayerCalendar calendar;
    private final WalletService wallet;
    private final Clock clock;

    public ProgressionSummaryService(
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

    @Transactional
    public ProgressionResponse summary(UUID userId) {
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
}
