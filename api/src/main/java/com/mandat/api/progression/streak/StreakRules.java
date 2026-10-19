package com.mandat.api.progression.streak;

import com.mandat.api.progression.PlayerCalendar;
import java.time.LocalDate;

/**
 * Pure streak rules on calendar days (player timezone).
 *
 * <ul>
 *   <li>An activity (booster opened, quiz finished) on a new day extends the streak if the previous
 *       active day was yesterday.
 *   <li>Exactly one missed day is forgiven by the free freeze of that day's ISO week, applied
 *       automatically, at most once per ISO week.
 *   <li>Otherwise the streak restarts at 1.
 * </ul>
 */
public final class StreakRules {

    private StreakRules() {}

    public record State(int current, int best, LocalDate lastActiveDay, String lastFreezeWeek) {}

    /** State after an activity on {@code today}. */
    public static State recordActivity(State state, LocalDate today) {
        LocalDate last = state.lastActiveDay();
        if (last != null && !today.isAfter(last)) {
            return state; // already counted today (or clock skew between timezones changes)
        }
        int current;
        String freezeWeek = state.lastFreezeWeek();
        if (last != null && last.plusDays(1).equals(today)) {
            current = state.current() + 1;
        } else if (last != null && last.plusDays(2).equals(today) && freezeAvailableFor(state, today.minusDays(1))) {
            current = state.current() + 1;
            freezeWeek = PlayerCalendar.isoWeek(today.minusDays(1));
        } else {
            current = 1;
        }
        return new State(current, Math.max(state.best(), current), today, freezeWeek);
    }

    /** Streak as the player should see it today, without recording an activity. */
    public static int effectiveStreak(State state, LocalDate today) {
        LocalDate last = state.lastActiveDay();
        if (last == null) {
            return 0;
        }
        if (!last.isBefore(today.minusDays(1))) {
            return state.current();
        }
        if (last.plusDays(2).equals(today) && freezeAvailableFor(state, today.minusDays(1))) {
            return state.current(); // yesterday is covered by the freeze if the player plays today
        }
        return 0;
    }

    public static boolean activeToday(State state, LocalDate today) {
        return today.equals(state.lastActiveDay());
    }

    /** Whether the free freeze of {@code day}'s ISO week is still unused. */
    public static boolean freezeAvailableFor(State state, LocalDate day) {
        return !PlayerCalendar.isoWeek(day).equals(state.lastFreezeWeek());
    }
}
