package com.mandat.api.progression;

import java.util.List;

public record RewardDto(int xp, int influence, int bonusPacks, List<UnlockDto> unlocks) {

    public record UnlockDto(String kind, String itemId) {}

    public static RewardDto from(Reward reward) {
        return new RewardDto(
                reward.xp(),
                reward.influence(),
                reward.bonusPacks(),
                reward.unlocks().stream().map(u -> new UnlockDto(u.kind().name(), u.itemId())).toList());
    }
}
