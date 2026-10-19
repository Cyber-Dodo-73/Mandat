package com.mandat.api.progression.streak;

import static org.assertj.core.api.Assertions.assertThat;

import com.mandat.api.progression.streak.StreakRules.Activity;
import com.mandat.api.progression.streak.StreakRules.RepairOffer;
import com.mandat.api.progression.streak.StreakRules.State;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class StreakRulesTest {

    // 2026-10-19 is a Monday (ISO week 2026-W43).
    private static final LocalDate MONDAY = LocalDate.of(2026, 10, 19);
    private static final State EMPTY = State.fresh();

    /** A running streak whose weekly freeze of W43 is already granted. */
    private static State running(int current, LocalDate lastActive, int freezes) {
        return new State(current, current, lastActive, "2026-W43", freezes, 0, null, false, null);
    }

    private static State play(State state, LocalDate day) {
        return StreakRules.recordActivity(state, day).state();
    }

    @Test
    void firstActivityStartsTheStreakAndGrantsTheWeeklyFreeze() {
        State state = play(EMPTY, MONDAY);
        assertThat(state.current()).isEqualTo(1);
        assertThat(state.best()).isEqualTo(1);
        assertThat(state.lastActiveDay()).isEqualTo(MONDAY);
        assertThat(state.freezes()).isEqualTo(1);
        assertThat(state.weeklyFreezeWeek()).isEqualTo("2026-W43");
    }

    @Test
    void sameDayCountsOnce() {
        State state = play(EMPTY, MONDAY);
        Activity again = StreakRules.recordActivity(state, MONDAY);
        assertThat(again.counted()).isFalse();
        assertThat(again.state()).isEqualTo(state);
    }

    @Test
    void consecutiveDaysExtendTheStreak() {
        State state = EMPTY;
        for (int day = 0; day < 5; day++) {
            state = play(state, MONDAY.plusDays(day));
        }
        assertThat(state.current()).isEqualTo(5);
        assertThat(state.best()).isEqualTo(5);
    }

    @Test
    void eachMissedDayConsumesOneFreeze() {
        Activity activity = StreakRules.recordActivity(running(4, MONDAY, 2), MONDAY.plusDays(3)); // Tue + Wed missed
        assertThat(activity.state().current()).isEqualTo(5);
        assertThat(activity.state().freezes()).isZero();
        assertThat(activity.frozenDays()).containsExactly(MONDAY.plusDays(1), MONDAY.plusDays(2));
    }

    @Test
    void tooManyMissedDaysLoseTheStreakAndRememberIt() {
        State lost = play(running(9, MONDAY, 1), MONDAY.plusDays(3)); // 2 missed, 1 freeze
        assertThat(lost.current()).isEqualTo(1);
        assertThat(lost.best()).isEqualTo(9);
        assertThat(lost.freezes()).isZero();
        assertThat(lost.lostStreak()).isEqualTo(9);
        assertThat(lost.lostAfter()).isEqualTo(MONDAY);
        assertThat(lost.lostRepairable()).isTrue(); // exactly one uncovered day

        State badlyLost = play(running(9, MONDAY, 0), MONDAY.plusDays(4)); // 3 missed, no freeze
        assertThat(badlyLost.lostRepairable()).isFalse();
    }

    @Test
    void theWeeklyFreezeIsGrantedOncePerIsoWeekAndCapped() {
        State twoStocked = running(3, MONDAY, 2);
        // New ISO week (W44): stock already at the cap, stays at 2.
        State nextWeek = StreakRules.grantWeeklyFreeze(twoStocked, MONDAY.plusDays(7));
        assertThat(nextWeek.freezes()).isEqualTo(StreakRules.MAX_FREEZES);
        assertThat(nextWeek.weeklyFreezeWeek()).isEqualTo("2026-W44");
        // Same week again: nothing more.
        assertThat(StreakRules.grantWeeklyFreeze(running(3, MONDAY, 0), MONDAY.plusDays(2)).freezes()).isZero();
        assertThat(StreakRules.addFreezes(running(3, MONDAY, 1), 5).freezes()).isEqualTo(2);
    }

    @Test
    void effectiveStreakCountsFreezesNotSpentYet() {
        State state = running(5, MONDAY, 1);
        assertThat(StreakRules.effectiveStreak(state, MONDAY)).isEqualTo(5);
        assertThat(StreakRules.effectiveStreak(state, MONDAY.plusDays(1))).isEqualTo(5);
        assertThat(StreakRules.effectiveStreak(state, MONDAY.plusDays(2))).isEqualTo(5); // 1 missed, 1 freeze
        assertThat(StreakRules.effectiveStreak(state, MONDAY.plusDays(3))).isZero(); // 2 missed
        assertThat(StreakRules.effectiveStreak(running(5, MONDAY, 0), MONDAY.plusDays(2))).isZero();
        assertThat(StreakRules.effectiveStreak(EMPTY, MONDAY)).isZero();
        // Sunday played, Monday W44 missed: the W44 free freeze covers it.
        State sunday = running(6, MONDAY.plusDays(6), 0);
        assertThat(StreakRules.effectiveStreak(sunday, MONDAY.plusDays(8))).isEqualTo(6);
    }

    @Test
    void aBrokenStreakCanBeRepairedTheDayItIsNoticed() {
        State state = running(12, MONDAY, 0);
        LocalDate wednesday = MONDAY.plusDays(2); // Tuesday missed, no freeze
        RepairOffer offer = StreakRules.repairOffer(state, wednesday);
        assertThat(offer).isNotNull();
        assertThat(offer.restoresTo()).isEqualTo(12);
        assertThat(offer.bridgedDays()).containsExactly(MONDAY.plusDays(1));

        State repaired = StreakRules.repair(state, wednesday, offer);
        assertThat(repaired.lastRepairMonth()).isEqualTo("2026-10");
        assertThat(StreakRules.effectiveStreak(repaired, wednesday)).isEqualTo(12);
        assertThat(play(repaired, wednesday).current()).isEqualTo(13);

        // One repair per month.
        assertThat(StreakRules.repairOffer(running(3, wednesday.plusDays(5), 0)
                .withRepairMonth("2026-10"), wednesday.plusDays(7))).isNull();
        // Too late: two days missed with no freeze.
        assertThat(StreakRules.repairOffer(state, MONDAY.plusDays(3))).isNull();
    }

    @Test
    void aStreakRestartedTodayCanStillBeRepaired() {
        State restarted = play(running(8, MONDAY, 0), MONDAY.plusDays(2)); // Tuesday missed
        RepairOffer offer = StreakRules.repairOffer(restarted, MONDAY.plusDays(2));
        assertThat(offer).isNotNull();
        assertThat(offer.restoresTo()).isEqualTo(9);
        assertThat(offer.bridgedDays()).containsExactly(MONDAY.plusDays(1));
        State repaired = StreakRules.repair(restarted, MONDAY.plusDays(2), offer);
        assertThat(repaired.current()).isEqualTo(9);
        assertThat(repaired.best()).isEqualTo(9);
        // Next day the offer is gone.
        assertThat(StreakRules.repairOffer(play(restarted, MONDAY.plusDays(3)), MONDAY.plusDays(3))).isNull();
    }
}
