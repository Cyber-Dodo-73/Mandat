package com.mandat.api.economy;

import com.mandat.api.progression.PlayerCalendar;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/** Counts today's rewarded quizzes and duel wins, "today" being the player's local calendar day. */
@Service
public class DailyRewardLimits {

    private final JdbcClient jdbc;
    private final PlayerCalendar calendar;

    public DailyRewardLimits(JdbcClient jdbc, PlayerCalendar calendar) {
        this.jdbc = jdbc;
        this.calendar = calendar;
    }

    public int quizRewardsUsed(UUID userId, Instant now) {
        Day day = day(userId, now);
        return jdbc.sql("""
                        select count(*) from quiz_sessions
                        where user_id = :userId and rewarded and completed_at >= :from and completed_at < :to
                        """)
                .param("userId", userId)
                .param("from", day.from())
                .param("to", day.to())
                .query(Integer.class)
                .single();
    }

    public int duelWinRewardsUsed(UUID userId, Instant now) {
        Day day = day(userId, now);
        return jdbc.sql("""
                        select count(*) from duels
                        where user_id = :userId and rewarded and winner = 'player'
                          and finished_at >= :from and finished_at < :to
                        """)
                .param("userId", userId)
                .param("from", day.from())
                .param("to", day.to())
                .query(Integer.class)
                .single();
    }

    public boolean quizRewardAvailable(UUID userId, Instant now) {
        return quizRewardsUsed(userId, now) < RewardLimits.QUIZ_REWARDS_PER_DAY;
    }

    public boolean duelRewardAvailable(UUID userId, Instant now) {
        return duelWinRewardsUsed(userId, now) < RewardLimits.DUEL_WIN_REWARDS_PER_DAY;
    }

    /** Start of the player's next local day: when the daily caps reset. */
    public Instant resetsAt(UUID userId, Instant now) {
        return day(userId, now).to().toInstant();
    }

    private Day day(UUID userId, Instant now) {
        ZoneId zone = calendar.zoneOf(userId);
        LocalDate today = PlayerCalendar.localDate(now, zone);
        return new Day(
                Timestamp.from(today.atStartOfDay(zone).toInstant()),
                Timestamp.from(today.plusDays(1).atStartOfDay(zone).toInstant()));
    }

    private record Day(Timestamp from, Timestamp to) {}
}
