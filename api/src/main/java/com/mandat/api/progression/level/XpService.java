package com.mandat.api.progression.level;

import com.mandat.api.common.progression.PlayerLevelProvider;
import com.mandat.api.common.wallet.WalletService;
import com.mandat.api.common.wallet.WalletSource;
import com.mandat.api.progression.PlayerProgress;
import com.mandat.api.progression.ProgressRepository;
import com.mandat.api.progression.ProgressionProperties;
import com.mandat.api.progression.Reward;
import com.mandat.api.progression.Reward.Unlock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Grants XP (lifetime + season) and the rewards of every level reached on the way. */
@Service
@Primary
public class XpService implements PlayerLevelProvider {

    private final ProgressRepository progress;
    private final XpCurve curve;
    private final LevelRewardCatalog levelRewards;
    private final WalletService wallet;
    private final String seasonId;

    public XpService(
            ProgressRepository progress,
            XpCurve curve,
            LevelRewardCatalog levelRewards,
            WalletService wallet,
            ProgressionProperties properties) {
        this.progress = progress;
        this.curve = curve;
        this.levelRewards = levelRewards;
        this.wallet = wallet;
        this.seasonId = properties.season().id();
    }

    /** Creates the player's progression rows on first use. */
    @Transactional
    public void ensure(UUID userId) {
        progress.ensure(userId, seasonId);
    }

    @Override
    @Transactional(readOnly = true)
    public int levelOf(UUID userId) {
        return progress.find(userId).map(PlayerProgress::level).orElse(1);
    }

    @Transactional
    public XpGrant grant(UUID userId, int amount, Instant now) {
        if (amount < 0) {
            throw new IllegalArgumentException("XP amount must not be negative");
        }
        ensure(userId);
        PlayerProgress current = progress.lock(userId);
        int totalXp = current.totalXp() + amount;
        int level = Math.max(current.level(), curve.levelFor(totalXp));
        progress.updateXp(userId, totalXp, level, current.seasonXp() + amount, now);

        List<Integer> levelsGained = new ArrayList<>();
        Reward rewards = Reward.NONE;
        for (int reached = current.level() + 1; reached <= level; reached++) {
            Reward reward = levelRewards.rewardFor(reached);
            applyLevelReward(userId, reached, reward, now);
            levelsGained.add(reached);
            rewards = rewards.plus(reward);
        }
        return new XpGrant(amount, totalXp, level, List.copyOf(levelsGained), rewards);
    }

    private void applyLevelReward(UUID userId, int level, Reward reward, Instant now) {
        if (reward.influence() > 0) {
            wallet.addInfluence(userId, reward.influence(), WalletSource.LEVEL_REWARD);
        }
        if (reward.bonusPacks() > 0) {
            wallet.addBonusPacks(userId, reward.bonusPacks(), WalletSource.LEVEL_REWARD);
        }
        for (Unlock unlock : reward.unlocks()) {
            progress.addUnlock(userId, unlock, "level:" + level, now);
        }
    }

    /** Outcome of an XP grant; {@code levelRewards} were already applied. */
    public record XpGrant(int xpGained, int totalXp, int level, List<Integer> levelsGained, Reward levelRewards) {}
}
