package com.mandat.api.progression.achievement;

import com.mandat.api.common.progression.CollectionStatsProvider;
import com.mandat.api.progression.PlayerProgress;
import com.mandat.api.progression.PlayerStats;
import com.mandat.api.progression.ProgressRepository;
import com.mandat.api.progression.RewardGranter;
import com.mandat.api.progression.achievement.AchievementCatalog.Definition;
import com.mandat.api.progression.level.XpService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Computes achievement progress from player counters, streak, level and collection stats, and
 * unlocks (with rewards) every achievement whose threshold is met.
 */
@Service
public class AchievementService {

    /** Rewards can cause level-ups that unlock level achievements: re-check a few times. */
    private static final int MAX_EVALUATION_ROUNDS = 5;

    private final AchievementCatalog catalog;
    private final AchievementRepository achievements;
    private final ProgressRepository progress;
    private final XpService xp;
    private final RewardGranter rewards;
    private final ObjectProvider<CollectionStatsProvider> collectionStats;

    public AchievementService(
            AchievementCatalog catalog,
            AchievementRepository achievements,
            ProgressRepository progress,
            XpService xp,
            RewardGranter rewards,
            ObjectProvider<CollectionStatsProvider> collectionStats) {
        this.catalog = catalog;
        this.achievements = achievements;
        this.progress = progress;
        this.xp = xp;
        this.rewards = rewards;
        this.collectionStats = collectionStats;
    }

    public record AchievementView(Definition definition, int progress, Instant unlockedAt) {}

    @Transactional
    public List<AchievementView> list(UUID userId) {
        xp.ensure(userId);
        Map<String, Instant> unlocked = achievements.unlocked(userId);
        Metrics metrics = metrics(userId);
        return catalog.all().stream()
                .map(def -> new AchievementView(
                        def,
                        Math.min(def.threshold(), metrics.value(def)),
                        unlocked.get(def.id())))
                .toList();
    }

    /** Unlocks newly reached achievements and grants their rewards. Returns the unlocked ids. */
    @Transactional
    public List<String> evaluate(UUID userId, Instant now) {
        xp.ensure(userId);
        List<String> newlyUnlocked = new ArrayList<>();
        for (int round = 0; round < MAX_EVALUATION_ROUNDS; round++) {
            Map<String, Instant> unlocked = achievements.unlocked(userId);
            Metrics metrics = metrics(userId);
            List<Definition> reached = catalog.all().stream()
                    .filter(def -> !unlocked.containsKey(def.id()))
                    .filter(def -> metrics.value(def) >= def.threshold())
                    .toList();
            if (reached.isEmpty()) {
                break;
            }
            for (Definition def : reached) {
                if (achievements.unlock(userId, def.id(), now)) {
                    rewards.grant(userId, def.reward(), "achievement:" + def.id(), now);
                    newlyUnlocked.add(def.id());
                }
            }
        }
        return List.copyOf(newlyUnlocked);
    }

    private Metrics metrics(UUID userId) {
        PlayerProgress row = progress.find(userId).orElseThrow();
        return new Metrics(userId, progress.stats(userId), row, collectionStats.getIfAvailable(() -> CollectionStatsProvider.NONE));
    }

    /** Lazily computed metric values (collection queries only run when needed). */
    private static final class Metrics {

        private final UUID userId;
        private final PlayerStats stats;
        private final PlayerProgress progress;
        private final CollectionStatsProvider collection;
        private final Map<String, Integer> cache = new HashMap<>();

        Metrics(UUID userId, PlayerStats stats, PlayerProgress progress, CollectionStatsProvider collection) {
            this.userId = userId;
            this.stats = stats;
            this.progress = progress;
            this.collection = collection;
        }

        int value(Definition def) {
            return cache.computeIfAbsent(def.metric() + ":" + def.param(), key -> compute(def));
        }

        private int compute(Definition def) {
            return switch (def.metric()) {
                case PACKS_OPENED -> stats.packsOpened();
                case DISTINCT_CARDS -> collection.distinctCards(userId);
                case CARDS_FROM_CONTINENT -> collection.distinctCardsByContinent(userId, def.param());
                case CARDS_FROM_ERA -> collection.distinctCardsByEra(userId, def.param());
                case CARDS_OF_RARITY -> collection.distinctCardsByRarity(userId, def.param());
                case CARDS_WITH_FINISH -> collection.distinctCardsByFinish(userId, def.param());
                case BEST_STREAK -> progress.bestStreak();
                case LEVEL -> progress.level();
                case QUIZZES_COMPLETED -> stats.quizzesCompleted();
                case PERFECT_QUIZZES -> stats.perfectQuizzes();
                case DUELS_WON -> stats.duelsWon();
                case CARDS_RECYCLED -> stats.cardsRecycled();
                case CARDS_CRAFTED -> stats.cardsCrafted();
            };
        }
    }
}
