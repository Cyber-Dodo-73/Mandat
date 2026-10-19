package com.mandat.api.progression.seasonpass;

import com.mandat.api.progression.ProgressionProperties;
import com.mandat.api.progression.Reward;
import com.mandat.api.progression.Reward.Unlock;
import org.springframework.stereotype.Component;

/**
 * Free season pass: tier {@code t} unlocks at {@code t × xpPerTier} season XP. Every 5th tier gives
 * a booster, every 10th a cosmetic, the last one a title; the others give Influence.
 */
@Component
public class SeasonPassCatalog {

    private final String seasonId;
    private final int tiers;
    private final int xpPerTier;

    public SeasonPassCatalog(ProgressionProperties properties) {
        this.seasonId = properties.season().id();
        this.tiers = properties.season().tiers();
        this.xpPerTier = properties.season().xpPerTier();
    }

    public String seasonId() {
        return seasonId;
    }

    public int tiers() {
        return tiers;
    }

    public int xpPerTier() {
        return xpPerTier;
    }

    public boolean exists(int tier) {
        return tier >= 1 && tier <= tiers;
    }

    public int requiredXp(int tier) {
        return tier * xpPerTier;
    }

    public int tierReached(int seasonXp) {
        return Math.min(tiers, seasonXp / xpPerTier);
    }

    public Reward rewardFor(int tier) {
        String prefix = seasonId + "_tier_" + tier;
        if (tier == tiers) {
            return Reward.packs(3).plus(Reward.unlock(Unlock.Kind.title, "title." + seasonId + "_champion"));
        }
        if (tier % 10 == 0) {
            Unlock.Kind kind = (tier / 10) % 2 == 1 ? Unlock.Kind.avatar : Unlock.Kind.banner;
            return Reward.packs(1).plus(Reward.unlock(kind, kind.name() + "." + prefix));
        }
        if (tier % 5 == 0) {
            return Reward.packs(1);
        }
        return Reward.influence(20 + 5 * (tier / 10));
    }
}
