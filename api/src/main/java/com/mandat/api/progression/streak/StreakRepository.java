package com.mandat.api.progression.streak;

import com.mandat.api.progression.streak.StreakRules.State;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Streak columns of {@code player_progress}, {@code streak_days} and streak milestones. */
@Repository
public class StreakRepository {

    private static final String COLUMNS = """
            current_streak, best_streak, last_active_day, last_freeze_week, freezes,
            lost_streak, lost_after, lost_repairable, last_repair_month""";

    public enum DayStatus { active, frozen }

    private final JdbcClient jdbc;

    StreakRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Reads the streak with a write lock (the row must exist, see XpService.ensure). */
    public State lock(UUID userId) {
        return jdbc.sql("select " + COLUMNS + " from player_progress where user_id = :id for update")
                .param("id", userId).query(StreakRepository::map).single();
    }

    public Optional<State> find(UUID userId) {
        return jdbc.sql("select " + COLUMNS + " from player_progress where user_id = :id")
                .param("id", userId).query(StreakRepository::map).optional();
    }

    public void save(UUID userId, State state, Instant now) {
        jdbc.sql("""
                        update player_progress set
                            current_streak = :current, best_streak = :best, last_active_day = :day,
                            last_freeze_week = :week, freezes = :freezes, lost_streak = :lost,
                            lost_after = :lostAfter, lost_repairable = :repairable,
                            last_repair_month = :repairMonth, updated_at = :now
                        where user_id = :id""")
                .param("current", state.current()).param("best", state.best())
                .param("day", date(state.lastActiveDay())).param("week", state.weeklyFreezeWeek())
                .param("freezes", state.freezes()).param("lost", state.lostStreak())
                .param("lostAfter", date(state.lostAfter())).param("repairable", state.lostRepairable())
                .param("repairMonth", state.lastRepairMonth())
                .param("now", Timestamp.from(now)).param("id", userId)
                .update();
    }

    /** Records a kept day; an active day wins over a frozen one. */
    public void markDay(UUID userId, LocalDate day, DayStatus status) {
        jdbc.sql("""
                        insert into streak_days (user_id, day, status) values (:id, :day, :status)
                        on conflict (user_id, day) do update set status = case
                            when streak_days.status = 'active' or excluded.status = 'active' then 'active' else 'frozen' end""")
                .param("id", userId).param("day", Date.valueOf(day)).param("status", status.name())
                .update();
    }

    public void markDays(UUID userId, Collection<LocalDate> days, DayStatus status) {
        days.forEach(day -> markDay(userId, day, status));
    }

    /** Kept days of the player between {@code from} and {@code to} (inclusive). */
    public Map<LocalDate, DayStatus> days(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, DayStatus> days = new TreeMap<>();
        jdbc.sql("select day, status from streak_days where user_id = :id and day between :from and :to")
                .param("id", userId).param("from", Date.valueOf(from)).param("to", Date.valueOf(to))
                .query(rs -> {
                    days.put(rs.getDate("day").toLocalDate(), DayStatus.valueOf(rs.getString("status")));
                });
        return days;
    }

    public Optional<LocalDate> firstDay(UUID userId) {
        return jdbc.sql("select min(day) from streak_days where user_id = :id")
                .param("id", userId).query(Date.class).optional().map(Date::toLocalDate);
    }

    /** False when the milestone was already rewarded. */
    public boolean claimMilestone(UUID userId, int milestone, Instant now) {
        return jdbc.sql("""
                        insert into streak_milestone_rewards (user_id, milestone, granted_at) values (:id, :m, :now)
                        on conflict do nothing""")
                .param("id", userId).param("m", milestone).param("now", Timestamp.from(now))
                .update() == 1;
    }

    private static Date date(LocalDate day) {
        return day == null ? null : Date.valueOf(day);
    }

    private static State map(ResultSet rs, int row) throws SQLException {
        Date last = rs.getDate("last_active_day");
        Date lostAfter = rs.getDate("lost_after");
        return new State(
                rs.getInt("current_streak"),
                rs.getInt("best_streak"),
                last == null ? null : last.toLocalDate(),
                rs.getString("last_freeze_week"),
                rs.getInt("freezes"),
                rs.getInt("lost_streak"),
                lostAfter == null ? null : lostAfter.toLocalDate(),
                rs.getBoolean("lost_repairable"),
                rs.getString("last_repair_month"));
    }
}
