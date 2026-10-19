package com.mandat.api.progression.streak;

import static org.assertj.core.api.Assertions.assertThat;

import com.mandat.api.progression.streak.FriendStreakRules.PlayerDays;
import com.mandat.api.progression.streak.StreakRepository.DayStatus;
import com.mandat.api.progression.streak.StreakRules.State;
import java.time.LocalDate;
import java.util.Map;
import java.util.TreeMap;
import org.junit.jupiter.api.Test;

class FriendStreakRulesTest {

    private static final LocalDate MONDAY = LocalDate.of(2026, 10, 19);

    private static PlayerDays player(LocalDate today, int freezes, Object... dayStatusPairs) {
        Map<LocalDate, DayStatus> days = new TreeMap<>();
        LocalDate last = null;
        for (int i = 0; i < dayStatusPairs.length; i += 2) {
            LocalDate day = (LocalDate) dayStatusPairs[i];
            DayStatus status = (DayStatus) dayStatusPairs[i + 1];
            days.put(day, status);
            if (status == DayStatus.active && (last == null || day.isAfter(last))) {
                last = day;
            }
        }
        // Weekly freeze of W43 already granted: `freezes` is the whole stock.
        State state = new State(1, 1, last, "2026-W43", freezes, 0, null, false, null);
        return new PlayerDays(state, days, today);
    }

    @Test
    void consecutiveSharedDaysGrow() {
        LocalDate tue = MONDAY.plusDays(1);
        PlayerDays a = player(tue, 0, MONDAY, DayStatus.active, tue, DayStatus.active);
        PlayerDays b = player(tue, 0, MONDAY, DayStatus.active, tue, DayStatus.active);
        assertThat(FriendStreakRules.afterSharedDay(3, MONDAY, tue, a, b)).isEqualTo(4);
        assertThat(FriendStreakRules.afterSharedDay(0, null, tue, a, b)).isEqualTo(1);
    }

    @Test
    void aFrozenDayKeepsTheFriendStreakButDoesNotGrowIt() {
        LocalDate wed = MONDAY.plusDays(2);
        PlayerDays a = player(wed, 0, MONDAY, DayStatus.active, MONDAY.plusDays(1), DayStatus.frozen, wed, DayStatus.active);
        PlayerDays b = player(wed, 0, MONDAY, DayStatus.active, MONDAY.plusDays(1), DayStatus.active, wed, DayStatus.active);
        // Tuesday was not shared (A froze it) but kept by both: Wednesday extends from 5 to 6.
        assertThat(FriendStreakRules.afterSharedDay(5, MONDAY, wed, a, b)).isEqualTo(6);
    }

    @Test
    void aDayLostByOnePlayerBreaksIt() {
        LocalDate wed = MONDAY.plusDays(2);
        PlayerDays a = player(wed, 0, MONDAY, DayStatus.active, wed, DayStatus.active); // Tuesday lost
        PlayerDays b = player(wed, 0, MONDAY, DayStatus.active, MONDAY.plusDays(1), DayStatus.active, wed, DayStatus.active);
        assertThat(FriendStreakRules.afterSharedDay(5, MONDAY, wed, a, b)).isEqualTo(1);
        assertThat(FriendStreakRules.effective(5, MONDAY, a, b)).isZero();
    }

    @Test
    void effectiveCountsPendingFreezesOfAPlayerWhoHasNotComeBackYet() {
        LocalDate wed = MONDAY.plusDays(2);
        // B played Monday then nothing; they still hold one freeze, which covers Tuesday.
        PlayerDays a = player(wed, 0, MONDAY, DayStatus.active, MONDAY.plusDays(1), DayStatus.active, wed, DayStatus.active);
        PlayerDays withFreeze = player(wed, 1, MONDAY, DayStatus.active);
        PlayerDays withoutFreeze = player(wed, 0, MONDAY, DayStatus.active);
        assertThat(FriendStreakRules.effective(4, MONDAY, a, withFreeze)).isEqualTo(4);
        assertThat(FriendStreakRules.effective(4, MONDAY, a, withoutFreeze)).isZero();
    }

    @Test
    void eachPlayerIsJudgedOnTheirOwnCalendar() {
        // A is already on Wednesday (played Tuesday), B is still on Tuesday: alive.
        PlayerDays a = player(MONDAY.plusDays(2), 0, MONDAY, DayStatus.active, MONDAY.plusDays(1), DayStatus.active);
        PlayerDays b = player(MONDAY.plusDays(1), 0, MONDAY, DayStatus.active);
        assertThat(FriendStreakRules.effective(7, MONDAY, a, b)).isEqualTo(7);
        // A's Tuesday is over and wasn't kept: broken even though B's Tuesday isn't over.
        PlayerDays aMissed = player(MONDAY.plusDays(2), 0, MONDAY, DayStatus.active);
        assertThat(FriendStreakRules.effective(7, MONDAY, aMissed, b)).isZero();
    }
}
