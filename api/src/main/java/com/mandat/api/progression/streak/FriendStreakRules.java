package com.mandat.api.progression.streak;

import com.mandat.api.progression.streak.StreakRepository.DayStatus;
import com.mandat.api.progression.streak.StreakRules.State;
import java.time.LocalDate;
import java.util.Map;

/**
 * Friend streak rules (pure).
 *
 * <ul>
 *   <li>A shared day is a calendar date on which BOTH players kept their own streak with an
 *       activity, each date read in the player's own timezone (so two players far apart share
 *       "Tuesday" when each played on their own Tuesday).
 *   <li>Consecutive shared days extend the friend streak. Days in between must be kept by both:
 *       a day protected by a player's own freeze or repair counts as kept, so freezes protect
 *       friend streaks too, but only days played by both make the counter grow.
 *   <li>The friend streak is broken as soon as one of the two players lost a day; it then restarts
 *       at 1 on the next shared day.
 * </ul>
 */
public final class FriendStreakRules {

    private FriendStreakRules() {}

    /** One player's kept days, as seen today. */
    public record PlayerDays(State state, Map<LocalDate, DayStatus> days, LocalDate today) {

        public boolean activeOn(LocalDate day) {
            return days.get(day) == DayStatus.active;
        }

        /**
         * Kept on {@code day}: played or protected, or not over yet while the player's freezes would
         * still cover it (they are only spent when the player comes back).
         */
        public boolean held(LocalDate day) {
            if (days.containsKey(day)) {
                return true;
            }
            LocalDate last = state.lastActiveDay();
            if (last == null || !day.isAfter(last) || day.isAfter(today)) {
                return false;
            }
            return StreakRules.missedDays(last, day.plusDays(1)) <= StreakRules.freezesAvailable(state, today);
        }
    }

    /** Counter after a shared day {@code day}. */
    public static int afterSharedDay(int current, LocalDate lastShared, LocalDate day, PlayerDays a, PlayerDays b) {
        if (lastShared == null || current == 0) {
            return 1;
        }
        if (!day.isAfter(lastShared)) {
            return current;
        }
        return continuous(lastShared, day, a, b) ? current + 1 : 1;
    }

    /**
     * Counter as shown today: 0 once a day after the last shared day is over for one of the players
     * (before their own today) and wasn't kept by them.
     */
    public static int effective(int current, LocalDate lastShared, PlayerDays a, PlayerDays b) {
        if (lastShared == null || current == 0) {
            return 0;
        }
        return keptSoFar(lastShared, a) && keptSoFar(lastShared, b) ? current : 0;
    }

    private static boolean keptSoFar(LocalDate lastShared, PlayerDays player) {
        for (LocalDate d = lastShared.plusDays(1); d.isBefore(player.today()); d = d.plusDays(1)) {
            if (!player.held(d)) {
                return false;
            }
        }
        return true;
    }

    /** Every day strictly between {@code from} and {@code to} was kept by both players. */
    static boolean continuous(LocalDate from, LocalDate to, PlayerDays a, PlayerDays b) {
        for (LocalDate d = from.plusDays(1); d.isBefore(to); d = d.plusDays(1)) {
            if (!a.held(d) || !b.held(d)) {
                return false;
            }
        }
        return true;
    }
}
