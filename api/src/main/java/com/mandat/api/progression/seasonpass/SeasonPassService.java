package com.mandat.api.progression.seasonpass;

import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import com.mandat.api.progression.PlayerProgress;
import com.mandat.api.progression.ProgressRepository;
import com.mandat.api.progression.RewardGranter;
import com.mandat.api.progression.achievement.AchievementService;
import com.mandat.api.progression.level.XpService;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SeasonPassService {

    private final SeasonPassCatalog catalog;
    private final ProgressRepository progress;
    private final XpService xp;
    private final RewardGranter rewards;
    private final AchievementService achievements;
    private final JdbcClient jdbc;

    public SeasonPassService(
            SeasonPassCatalog catalog,
            ProgressRepository progress,
            XpService xp,
            RewardGranter rewards,
            AchievementService achievements,
            JdbcClient jdbc) {
        this.catalog = catalog;
        this.progress = progress;
        this.xp = xp;
        this.rewards = rewards;
        this.achievements = achievements;
        this.jdbc = jdbc;
    }

    public record SeasonPassState(int seasonXp, Set<Integer> claimedTiers) {}

    @Transactional
    public SeasonPassState state(UUID userId) {
        xp.ensure(userId);
        PlayerProgress row = progress.find(userId).orElseThrow();
        return new SeasonPassState(row.seasonXp(), claimedTiers(userId));
    }

    @Transactional
    public RewardGranter.Granted claim(UUID userId, int tier, Instant now) {
        if (!catalog.exists(tier)) {
            throw new ApiException(ErrorCode.SEASON_TIER_NOT_FOUND, "Unknown season pass tier");
        }
        xp.ensure(userId);
        PlayerProgress row = progress.lock(userId);
        if (row.seasonXp() < catalog.requiredXp(tier)) {
            throw new ApiException(ErrorCode.REWARD_NOT_CLAIMABLE, "Season pass tier not reached yet");
        }
        boolean inserted = jdbc.sql("""
                        insert into season_pass_claims (user_id, season_id, tier, claimed_at)
                        values (:id, :season, :tier, :now) on conflict do nothing""")
                .param("id", userId).param("season", catalog.seasonId()).param("tier", tier)
                .param("now", Timestamp.from(now))
                .update() == 1;
        if (!inserted) {
            throw new ApiException(ErrorCode.REWARD_ALREADY_CLAIMED, "Season pass tier already claimed");
        }
        RewardGranter.Granted granted =
                rewards.grant(userId, catalog.rewardFor(tier), "season_pass:" + catalog.seasonId() + ":" + tier, now);
        achievements.evaluate(userId, now);
        return granted;
    }

    private Set<Integer> claimedTiers(UUID userId) {
        return new HashSet<>(jdbc.sql("select tier from season_pass_claims where user_id = :id and season_id = :season")
                .param("id", userId).param("season", catalog.seasonId())
                .query(Integer.class)
                .list());
    }
}
