package com.mandat.api.progression.level;

import static org.assertj.core.api.Assertions.assertThat;

import com.mandat.api.progression.Reward;
import com.mandat.api.progression.Reward.Unlock;
import org.junit.jupiter.api.Test;

class XpCurveTest {

    private final XpCurve curve = new XpCurve(100, 50, 100);

    @Test
    void costsGrowLinearly() {
        assertThat(curve.xpToAdvance(1)).isEqualTo(100);
        assertThat(curve.xpToAdvance(2)).isEqualTo(150);
        assertThat(curve.xpToAdvance(10)).isEqualTo(550);
    }

    @Test
    void totalXpIsTheSumOfPreviousSteps() {
        assertThat(curve.totalXpForLevel(1)).isZero();
        assertThat(curve.totalXpForLevel(2)).isEqualTo(100);
        assertThat(curve.totalXpForLevel(3)).isEqualTo(250);
        assertThat(curve.totalXpForLevel(4)).isEqualTo(450);
    }

    @Test
    void levelForTotalXp() {
        assertThat(curve.levelFor(0)).isEqualTo(1);
        assertThat(curve.levelFor(99)).isEqualTo(1);
        assertThat(curve.levelFor(100)).isEqualTo(2);
        assertThat(curve.levelFor(249)).isEqualTo(2);
        assertThat(curve.levelFor(250)).isEqualTo(3);
        assertThat(curve.levelFor(Integer.MAX_VALUE / 2)).isEqualTo(100);
    }

    @Test
    void levelRewards() {
        LevelRewardCatalog catalog = new LevelRewardCatalog();
        assertThat(catalog.rewardFor(1)).isEqualTo(Reward.NONE);
        assertThat(catalog.rewardFor(3)).isEqualTo(Reward.influence(20));
        assertThat(catalog.rewardFor(2).bonusPacks()).isEqualTo(1);

        Reward level10 = catalog.rewardFor(10);
        assertThat(level10.influence()).isEqualTo(20);
        assertThat(level10.bonusPacks()).isEqualTo(1);
        assertThat(level10.unlocks()).containsExactly(
                new Unlock(Unlock.Kind.avatar, "avatar.level_10"),
                new Unlock(Unlock.Kind.banner, "banner.level_10"));
        assertThat(catalog.rewardFor(15).unlocks())
                .contains(new Unlock(Unlock.Kind.title, "title.rising_statesman"));
    }
}
