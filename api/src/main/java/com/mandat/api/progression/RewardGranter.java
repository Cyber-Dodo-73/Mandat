package com.mandat.api.progression;

import com.mandat.api.common.wallet.WalletService;
import com.mandat.api.common.wallet.WalletSource;
import com.mandat.api.progression.Reward.Unlock;
import com.mandat.api.progression.level.XpService;
import com.mandat.api.progression.level.XpService.XpGrant;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Applies a {@link Reward} inside the caller's transaction (XP, wallet, cosmetics). */
@Service
@Transactional(propagation = Propagation.MANDATORY)
public class RewardGranter {

    private final XpService xp;
    private final WalletService wallet;
    private final ProgressRepository progress;

    public RewardGranter(XpService xp, WalletService wallet, ProgressRepository progress) {
        this.xp = xp;
        this.wallet = wallet;
        this.progress = progress;
    }

    public Granted grant(UUID userId, Reward reward, String source, Instant now) {
        XpGrant xpGrant = xp.grant(userId, reward.xp(), now);
        if (reward.influence() > 0) {
            wallet.addInfluence(userId, reward.influence(), WalletSource.PROGRESSION_REWARD);
        }
        if (reward.bonusPacks() > 0) {
            wallet.addBonusPacks(userId, reward.bonusPacks(), WalletSource.PROGRESSION_REWARD);
        }
        for (Unlock unlock : reward.unlocks()) {
            progress.addUnlock(userId, unlock, source, now);
        }
        return new Granted(reward, xpGrant.level(), xpGrant.totalXp(), xpGrant.levelsGained(), xpGrant.levelRewards());
    }

    /** The reward itself plus any level-ups it caused (whose rewards were applied too). */
    public record Granted(Reward reward, int level, int totalXp, List<Integer> levelsGained, Reward levelRewards) {}
}
