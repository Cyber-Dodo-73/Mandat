package com.mandat.api.progression;

import java.util.List;

/**
 * Result of a claim: the reward granted, plus the level-ups it triggered (their rewards, already
 * applied, are in {@code levelRewards}) so the app can play the level-up celebration.
 */
public record ClaimResponse(RewardDto reward, int level, int totalXp, List<Integer> levelsGained, RewardDto levelRewards) {

    public static ClaimResponse from(RewardGranter.Granted granted) {
        return new ClaimResponse(
                RewardDto.from(granted.reward()),
                granted.level(),
                granted.totalXp(),
                granted.levelsGained(),
                RewardDto.from(granted.levelRewards()));
    }
}
