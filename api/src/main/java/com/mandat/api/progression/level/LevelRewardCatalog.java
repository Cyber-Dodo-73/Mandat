package com.mandat.api.progression.level;

import com.mandat.api.progression.Reward;
import com.mandat.api.progression.Reward.Unlock;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Reward for reaching each level: 50 Influence every level, a bonus booster every even level,
 * an avatar every 5 levels, a banner every 10 levels and titles at milestones.
 */
@Component
public class LevelRewardCatalog {

    static final int INFLUENCE_PER_LEVEL = 20;

    private static final Map<Integer, String> TITLES = Map.of(
            15, "title.rising_statesman",
            30, "title.head_of_state",
            50, "title.world_leader",
            100, "title.living_legend");

    public Reward rewardFor(int level) {
        if (level < 2) {
            return Reward.NONE;
        }
        Reward reward = Reward.influence(INFLUENCE_PER_LEVEL);
        if (level % 2 == 0) {
            reward = reward.plus(Reward.packs(1));
        }
        if (level % 5 == 0) {
            reward = reward.plus(Reward.unlock(Unlock.Kind.avatar, "avatar.level_" + level));
        }
        if (level % 10 == 0) {
            reward = reward.plus(Reward.unlock(Unlock.Kind.banner, "banner.level_" + level));
        }
        String title = TITLES.get(level);
        if (title != null) {
            reward = reward.plus(Reward.unlock(Unlock.Kind.title, title));
        }
        return reward;
    }
}
