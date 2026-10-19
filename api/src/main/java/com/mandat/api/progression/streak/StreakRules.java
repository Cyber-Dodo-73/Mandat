package com.mandat.api.progression.streak;

import com.mandat.api.progression.PlayerCalendar;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * Pure streak rules on calendar days (player timezone), Duolingo style.
 *
 * <ul>
 *   <li>An activity (booster opened, quiz finished) on a new day extends the streak if the previous
 *       active day was yesterday.
 *   <li>Freezes are an inventory (max {@link #MAX_FREEZES}): one free freeze is granted per ISO
 *       week, lazily on the first look at the streak that week; milestones grant more; they can be
 *       bought. Each missed day consumes one freeze, automatically, when the player comes back.
 *   <li>If the missed days outnumber the freezes, the streak restarts at 1 and the lost streak is
 *       remembered: it can be repaired once per calendar month, the day the loss is noticed (within
 *       24 h after the streak ended), when a single uncovered day caused it.
 * </ul>
 */
public final class StreakRules {

    public static final int MAX_FREEZES = 2;

    private StreakRules() {}

    public record State(
            int current,
            int best,
            LocalDate lastActiveDay,
            String weeklyFreezeWeek,
            int freezes,
            int lostStreak,
            LocalDate lostAfter,
            boolean lostRepairable,
            String lastRepairMonth) {

        public static State fresh() {
            return new State(0, 0, null, null, 0, 0, null, false, null);
        }

        State withRepairMonth(String month) {
            return new State(current, best, lastActiveDay, weeklyFreezeWeek, freezes, lostStreak, lostAfter, lostRepairable, month);
        }

        State withFreezes(int value, String week) {
            return new State(current, best, lastActiveDay, week, value, lostStreak, lostAfter, lostRepairable, lastRepairMonth);
        }
    }

    /** Outcome of an activity: the new state and the past days a freeze protected. */
    public record Activity(State state, List<LocalDate> frozenDays, boolean counted) {}

    /** Grants this ISO week's free freeze if not granted yet (capped at {@link #MAX_FREEZES}). */
    public static State grantWeeklyFreeze(State state, LocalDate today) {
        String week = PlayerCalendar.isoWeek(today);
        if (week.equals(state.weeklyFreezeWeek())) {
            return state;
        }
        return state.withFreezes(Math.min(MAX_FREEZES, state.freezes() + 1), week);
    }

    /** Adds earned or bought freezes, capped at {@link #MAX_FREEZES}. */
    public static State addFreezes(State state, int count) {
        return state.withFreezes(Math.min(MAX_FREEZES, state.freezes() + count), state.weeklyFreezeWeek());
    }

    /** State after an activity on {@code today}. */
    public static Activity recordActivity(State state, LocalDate today) {
        LocalDate last = state.lastActiveDay();
        if (last != null && !today.isAfter(last)) {
            return new Activity(state, List.of(), false); // already counted today (or clock skew)
        }
        State s = grantWeeklyFreeze(state, today);
        if (last == null) {
            return new Activity(next(s, 1, today, s.freezes()), List.of(), true);
        }
        int missed = missedDays(last, today);
        if (missed == 0) {
            return new Activity(next(s, s.current() + 1, today, s.freezes()), List.of(), true);
        }
        if (missed <= s.freezes()) {
            return new Activity(next(s, s.current() + 1, today, s.freezes() - missed), daysBetween(last, today), true);
        }
        // Lost: remember it for the repair offer when a single uncovered day caused it.
        boolean repairable = missed == s.freezes() + 1 && s.current() > 0;
        State lost = new State(1, Math.max(s.best(), 1), today, s.weeklyFreezeWeek(), 0,
                s.current(), last, repairable, s.lastRepairMonth());
        return new Activity(lost, List.of(), true);
    }

    private static State next(State s, int current, LocalDate today, int freezes) {
        return new State(current, Math.max(s.best(), current), today, s.weeklyFreezeWeek(), freezes,
                s.lostStreak(), s.lostAfter(), s.lostRepairable(), s.lastRepairMonth());
    }

    /** Freezes the player has as of {@code today}, counting this week's free freeze. */
    public static int freezesAvailable(State state, LocalDate today) {
        return grantWeeklyFreeze(state, today).freezes();
    }

    /** Streak as the player should see it today, without recording an activity. */
    public static int effectiveStreak(State state, LocalDate today) {
        LocalDate last = state.lastActiveDay();
        if (last == null) {
            return 0;
        }
        int missed = missedDays(last, today);
        if (missed <= 0) {
            return state.current();
        }
        return missed <= freezesAvailable(state, today) ? state.current() : 0;
    }

    public static boolean activeToday(State state, LocalDate today) {
        return today.equals(state.lastActiveDay());
    }

    /** Days strictly between {@code last} and {@code today} with no activity. */
    public static int missedDays(LocalDate last, LocalDate today) {
        return (int) Math.max(0, ChronoUnit.DAYS.between(last, today) - 1);
    }

    static List<LocalDate> daysBetween(LocalDate from, LocalDate to) {
        List<LocalDate> days = new ArrayList<>();
        for (LocalDate d = from.plusDays(1); d.isBefore(to); d = d.plusDays(1)) {
            days.add(d);
        }
        return days;
    }

    // --- Repair ---------------------------------------------------------------------------

    /** What a repair would do today, if possible. */
    public record RepairOffer(int restoresTo, List<LocalDate> bridgedDays) {}

    /**
     * A repair is offered once per calendar month, within 24 h after a loss caused by exactly one
     * uncovered missed day: either the streak is shown broken today and the player hasn't played
     * yet, or the player already restarted at 1 today.
     */
    public static RepairOffer repairOffer(State state, LocalDate today) {
        if (YearMonth.from(today).toString().equals(state.lastRepairMonth()) || state.lastActiveDay() == null) {
            return null;
        }
        LocalDate last = state.lastActiveDay();
        if (last.isBefore(today)) {
            int missed = missedDays(last, today);
            int freezes = freezesAvailable(state, today);
            if (state.current() > 0 && missed == freezes + 1) {
                return new RepairOffer(state.current(), daysBetween(last, today));
            }
            return null;
        }
        // Restarted at 1 today right after the loss: the lost streak comes back, plus today.
        if (state.lostRepairable() && state.current() == 1 && state.lostStreak() > 0 && state.lostAfter() != null) {
            return new RepairOffer(state.lostStreak() + 1, daysBetween(state.lostAfter(), today));
        }
        return null;
    }

    /** Applies the repair offered today. Bridged days are kept as frozen days. */
    public static State repair(State state, LocalDate today, RepairOffer offer) {
        String month = YearMonth.from(today).toString();
        if (state.lastActiveDay().isBefore(today)) {
            // Not played yet today: the gap is bridged, playing today extends the restored streak.
            return new State(state.current(), state.best(), today.minusDays(1), state.weeklyFreezeWeek(), 0,
                    0, null, false, month);
        }
        int restored = offer.restoresTo();
        return new State(restored, Math.max(state.best(), restored), today, state.weeklyFreezeWeek(),
                state.freezes(), 0, null, false, month);
    }
}
