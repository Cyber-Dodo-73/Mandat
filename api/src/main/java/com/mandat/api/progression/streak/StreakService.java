package com.mandat.api.progression.streak;

import com.mandat.api.progression.PlayerCalendar;
import com.mandat.api.progression.PlayerProgress;
import com.mandat.api.progression.ProgressRepository;
import com.mandat.api.progression.level.XpService;
import com.mandat.api.progression.streak.StreakRules.State;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StreakService {

    private final ProgressRepository progress;
    private final PlayerCalendar calendar;
    private final XpService xp;

    public StreakService(ProgressRepository progress, PlayerCalendar calendar, XpService xp) {
        this.progress = progress;
        this.calendar = calendar;
        this.xp = xp;
    }

    /** Records a streak activity at {@code at} (server time) and returns the new streak. */
    @Transactional
    public int recordActivity(UUID userId, Instant at) {
        xp.ensure(userId);
        PlayerProgress row = progress.lock(userId);
        LocalDate today = PlayerCalendar.localDate(at, calendar.zoneOf(userId));
        State next = StreakRules.recordActivity(stateOf(row), today);
        progress.updateStreak(userId, next.current(), next.best(), next.lastActiveDay(), next.lastFreezeWeek(), at);
        return next.current();
    }

    public static State stateOf(PlayerProgress row) {
        return new State(row.currentStreak(), row.bestStreak(), row.lastActiveDay(), row.lastFreezeWeek());
    }
}
