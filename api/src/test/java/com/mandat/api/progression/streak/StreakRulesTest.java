package com.mandat.api.progression.streak;

import static org.assertj.core.api.Assertions.assertThat;

import com.mandat.api.progression.streak.StreakRules.State;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class StreakRulesTest {

    // 2026-10-19 is a Monday (ISO week 2026-W43).
    private static final LocalDate MONDAY = LocalDate.of(2026, 10, 19);
    private static final State EMPTY = new State(0, 0, null, null);

    @Test
    void firstActivityStartsTheStreak() {
        State state = StreakRules.recordActivity(EMPTY, MONDAY);
        assertThat(state).isEqualTo(new State(1, 1, MONDAY, null));
    }

    @Test
    void sameDayCountsOnce() {
        State state = StreakRules.recordActivity(EMPTY, MONDAY);
        assertThat(StreakRules.recordActivity(state, MONDAY)).isEqualTo(state);
    }

    @Test
    void consecutiveDaysExtendTheStreak() {
        State state = EMPTY;
        for (int day = 0; day < 5; day++) {
            state = StreakRules.recordActivity(state, MONDAY.plusDays(day));
        }
        assertThat(state.current()).isEqualTo(5);
        assertThat(state.best()).isEqualTo(5);
    }

    @Test
    void oneMissedDayIsCoveredByTheWeeklyFreeze() {
        State state = StreakRules.recordActivity(new State(4, 4, MONDAY, null), MONDAY.plusDays(2));
        assertThat(state.current()).isEqualTo(5);
        assertThat(state.lastFreezeWeek()).isEqualTo("2026-W43");
    }

    @Test
    void freezeWorksOncePerIsoWeek() {
        // Freeze used for Tuesday, then Thursday is missed in the same week: streak restarts.
        State afterFirstFreeze = StreakRules.recordActivity(new State(4, 4, MONDAY, null), MONDAY.plusDays(2));
        State afterSecondGap = StreakRules.recordActivity(afterFirstFreeze, MONDAY.plusDays(4));
        assertThat(afterSecondGap.current()).isEqualTo(1);
        assertThat(afterSecondGap.best()).isEqualTo(5);

        // A missed day in the next ISO week can be frozen again.
        State nextWeek = new State(6, 6, MONDAY.plusDays(6), "2026-W43"); // Sunday
        State covered = StreakRules.recordActivity(nextWeek, MONDAY.plusDays(8)); // missed Monday W44
        assertThat(covered.current()).isEqualTo(7);
        assertThat(covered.lastFreezeWeek()).isEqualTo("2026-W44");
    }

    @Test
    void twoMissedDaysResetTheStreak() {
        State state = StreakRules.recordActivity(new State(9, 12, MONDAY, null), MONDAY.plusDays(3));
        assertThat(state.current()).isEqualTo(1);
        assertThat(state.best()).isEqualTo(12);
    }

    @Test
    void effectiveStreakShowsBrokenStreaksAsZero() {
        State state = new State(5, 5, MONDAY, null);
        assertThat(StreakRules.effectiveStreak(state, MONDAY)).isEqualTo(5);
        assertThat(StreakRules.effectiveStreak(state, MONDAY.plusDays(1))).isEqualTo(5);
        assertThat(StreakRules.effectiveStreak(state, MONDAY.plusDays(2))).isEqualTo(5); // freeze pending
        assertThat(StreakRules.effectiveStreak(new State(5, 5, MONDAY, "2026-W43"), MONDAY.plusDays(2))).isZero();
        assertThat(StreakRules.effectiveStreak(state, MONDAY.plusDays(3))).isZero();
        assertThat(StreakRules.effectiveStreak(EMPTY, MONDAY)).isZero();
    }
}
