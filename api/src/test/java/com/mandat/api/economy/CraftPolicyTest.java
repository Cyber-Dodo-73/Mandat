package com.mandat.api.economy;

import static org.assertj.core.api.Assertions.assertThat;

import com.mandat.api.common.entitlement.Entitlement;
import com.mandat.api.economy.RewardLimits.CraftPolicy;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class CraftPolicyTest {

    static final Instant NOW = Instant.parse("2026-10-19T12:00:00Z");

    @Test
    void freePlayersEarnOneCraftEvery48HoursUpToThree() {
        CraftPolicy free = RewardLimits.craftPolicy(Entitlement.FREE);
        assertThat(free).isEqualTo(new CraftPolicy(Duration.ofHours(48), 3, 1));
        assertThat(CraftAllowanceService.compute(NOW.minus(Duration.ofHours(47)), NOW, free).available()).isZero();
        assertThat(CraftAllowanceService.compute(NOW.minus(Duration.ofHours(96)), NOW, free).available()).isEqualTo(2);
        CraftAllowanceService.Allowance full = CraftAllowanceService.compute(NOW.minus(Duration.ofDays(30)), NOW, free);
        assertThat(full.available()).isEqualTo(3);
        assertThat(full.nextAt()).isNull();
        assertThat(full.intervalHours()).isEqualTo(48);
    }

    @Test
    void premiumPlayersEarnOneCraftEvery36HoursUpToFour() {
        CraftPolicy premium = RewardLimits.craftPolicy(Entitlement.PREMIUM);
        assertThat(premium).isEqualTo(new CraftPolicy(Duration.ofHours(36), 4, 1));
        assertThat(CraftAllowanceService.compute(NOW.minus(Duration.ofHours(72)), NOW, premium).available()).isEqualTo(2);
        CraftAllowanceService.Allowance full = CraftAllowanceService.compute(NOW.minus(Duration.ofDays(30)), NOW, premium);
        assertThat(full.available()).isEqualTo(4);
        assertThat(full.max()).isEqualTo(4);
        assertThat(full.intervalHours()).isEqualTo(36);
    }
}
