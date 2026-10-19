package com.mandat.api.progression.achievement;

import com.mandat.api.progression.Reward;
import com.mandat.api.progression.Reward.Unlock;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Achievement definitions. Ids are stable keys the client maps to i18n ({@code achievements.<id>}).
 * Rewards are granted automatically when the achievement unlocks.
 */
@Component
public class AchievementCatalog {

    public record Definition(String id, String category, AchievementMetric metric, String param, int threshold, Reward reward) {}

    static final List<String> CONTINENTS =
            List.of("europe", "asia", "africa", "north_america", "south_america", "oceania");
    static final List<String> ERAS = List.of("antiquity", "medieval", "modern", "contemporary");

    private final List<Definition> definitions;

    public AchievementCatalog() {
        List<Definition> all = new ArrayList<>();

        // Boosters
        int[] packs = {1, 10, 50, 100, 250, 500};
        for (int i = 0; i < packs.length; i++) {
            all.add(def("packs_" + packs[i], "packs", AchievementMetric.PACKS_OPENED, null, packs[i], tierReward(i)));
        }

        // Collection size
        int[] distinct = {10, 50, 100, 250, 500};
        for (int i = 0; i < distinct.length; i++) {
            Reward reward = tierReward(i + 1);
            if (distinct[i] == 250) {
                reward = reward.plus(Reward.unlock(Unlock.Kind.title, "title.great_collector"));
            }
            if (distinct[i] == 500) {
                reward = reward.plus(Reward.unlock(Unlock.Kind.banner, "banner.complete_season_1"));
            }
            all.add(def("collection_" + distinct[i], "collection", AchievementMetric.DISTINCT_CARDS, null, distinct[i], reward));
        }

        // Continents: a first step and an expert step (with a title) per continent
        for (String continent : CONTINENTS) {
            int expert = continent.equals("oceania") ? 10 : 25;
            all.add(def("continent_" + continent + "_5", "continents", AchievementMetric.CARDS_FROM_CONTINENT, continent, 5, tierReward(1)));
            all.add(def("continent_" + continent + "_" + expert, "continents", AchievementMetric.CARDS_FROM_CONTINENT, continent, expert,
                    tierReward(3).plus(Reward.unlock(Unlock.Kind.title, "title.expert_" + continent))));
        }

        // Eras
        for (String era : ERAS) {
            int threshold = switch (era) {
                case "antiquity", "medieval" -> 5;
                default -> 15;
            };
            all.add(def("era_" + era + "_" + threshold, "eras", AchievementMetric.CARDS_FROM_ERA, era, threshold, tierReward(2)));
        }

        // Rarities
        all.add(def("rarity_rare_10", "rarities", AchievementMetric.CARDS_OF_RARITY, "rare", 10, tierReward(1)));
        all.add(def("rarity_epic_1", "rarities", AchievementMetric.CARDS_OF_RARITY, "epic", 1, tierReward(1)));
        all.add(def("rarity_epic_10", "rarities", AchievementMetric.CARDS_OF_RARITY, "epic", 10, tierReward(3)));
        all.add(def("rarity_legendary_1", "rarities", AchievementMetric.CARDS_OF_RARITY, "legendary", 1, tierReward(2)));
        all.add(def("rarity_legendary_5", "rarities", AchievementMetric.CARDS_OF_RARITY, "legendary", 5, tierReward(4)));
        all.add(def("rarity_mythic_1", "rarities", AchievementMetric.CARDS_OF_RARITY, "mythic", 1,
                tierReward(4).plus(Reward.unlock(Unlock.Kind.avatar, "avatar.mythic"))));
        all.add(def("rarity_mythic_3", "rarities", AchievementMetric.CARDS_OF_RARITY, "mythic", 3,
                tierReward(5).plus(Reward.unlock(Unlock.Kind.banner, "banner.mythic"))));

        // Finishes
        all.add(def("finish_holo_1", "finishes", AchievementMetric.CARDS_WITH_FINISH, "holo", 1, tierReward(1)));
        all.add(def("finish_holo_10", "finishes", AchievementMetric.CARDS_WITH_FINISH, "holo", 10, tierReward(3)));
        all.add(def("finish_full_art_1", "finishes", AchievementMetric.CARDS_WITH_FINISH, "full_art", 1, tierReward(3)));
        all.add(def("finish_gold_1", "finishes", AchievementMetric.CARDS_WITH_FINISH, "gold", 1,
                tierReward(5).plus(Reward.unlock(Unlock.Kind.title, "title.golden_touch"))));

        // Streaks
        int[] streaks = {3, 7, 30, 100};
        for (int i = 0; i < streaks.length; i++) {
            Reward reward = tierReward(i + 1);
            if (streaks[i] == 30) {
                reward = reward.plus(Reward.unlock(Unlock.Kind.title, "title.unwavering"));
            }
            all.add(def("streak_" + streaks[i], "streaks", AchievementMetric.BEST_STREAK, null, streaks[i], reward));
        }

        // Levels
        int[] levels = {5, 10, 25, 50};
        for (int i = 0; i < levels.length; i++) {
            all.add(def("level_" + levels[i], "levels", AchievementMetric.LEVEL, null, levels[i], tierReward(i + 1)));
        }

        // Quiz
        all.add(def("quiz_1", "quiz", AchievementMetric.QUIZZES_COMPLETED, null, 1, tierReward(0)));
        all.add(def("quiz_10", "quiz", AchievementMetric.QUIZZES_COMPLETED, null, 10, tierReward(2)));
        all.add(def("quiz_50", "quiz", AchievementMetric.QUIZZES_COMPLETED, null, 50, tierReward(4)));
        all.add(def("quiz_perfect_1", "quiz", AchievementMetric.PERFECT_QUIZZES, null, 1, tierReward(1)));
        all.add(def("quiz_perfect_10", "quiz", AchievementMetric.PERFECT_QUIZZES, null, 10,
                tierReward(4).plus(Reward.unlock(Unlock.Kind.title, "title.diplomat"))));

        // Duels
        all.add(def("duel_win_1", "duels", AchievementMetric.DUELS_WON, null, 1, tierReward(0)));
        all.add(def("duel_win_10", "duels", AchievementMetric.DUELS_WON, null, 10, tierReward(2)));
        all.add(def("duel_win_50", "duels", AchievementMetric.DUELS_WON, null, 50,
                tierReward(4).plus(Reward.unlock(Unlock.Kind.title, "title.strategist"))));

        // Recycling and crafting
        all.add(def("recycle_10", "workshop", AchievementMetric.CARDS_RECYCLED, null, 10, tierReward(1)));
        all.add(def("recycle_100", "workshop", AchievementMetric.CARDS_RECYCLED, null, 100, tierReward(3)));
        all.add(def("craft_1", "workshop", AchievementMetric.CARDS_CRAFTED, null, 1, tierReward(1)));
        all.add(def("craft_10", "workshop", AchievementMetric.CARDS_CRAFTED, null, 10, tierReward(3)));

        this.definitions = List.copyOf(all);
    }

    public List<Definition> all() {
        return definitions;
    }

    /** Reward ladder: tier 0 is a small pat on the back, tier 5 includes boosters. */
    static Reward tierReward(int tier) {
        return switch (tier) {
            case 0 -> Reward.xp(25).plus(Reward.influence(10));
            case 1 -> Reward.xp(50).plus(Reward.influence(20));
            case 2 -> Reward.xp(100).plus(Reward.influence(40));
            case 3 -> Reward.xp(150).plus(Reward.influence(60)).plus(Reward.packs(1));
            case 4 -> Reward.xp(250).plus(Reward.influence(100)).plus(Reward.packs(1));
            default -> Reward.xp(400).plus(Reward.influence(160)).plus(Reward.packs(2));
        };
    }

    private static Definition def(String id, String category, AchievementMetric metric, String param, int threshold, Reward reward) {
        return new Definition(id, category, metric, param, threshold, reward);
    }
}
