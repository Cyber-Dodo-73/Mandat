package com.mandat.api.progression.mission;

import com.mandat.api.progression.Reward;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/** Data-driven mission pools. Template ids are stable keys the client maps to i18n. */
@Component
public class MissionCatalog {

    public enum Period {
        daily, weekly
    }

    public record Template(String id, Period period, MissionType type, String param, int target, Reward reward) {}

    static final List<String> CONTINENTS =
            List.of("europe", "asia", "africa", "north_america", "south_america", "oceania");

    private final List<Template> daily;
    private final List<Template> weekly;
    private final Map<String, Template> byId;

    public MissionCatalog() {
        List<Template> dailyPool = new ArrayList<>(List.of(
                daily("daily.open_1_pack", MissionType.OPEN_PACKS, 1, Reward.xp(40).plus(Reward.influence(20))),
                daily("daily.open_2_packs", MissionType.OPEN_PACKS, 2, Reward.xp(60).plus(Reward.influence(30))),
                daily("daily.pull_rare", MissionType.PULL_RARE_OR_BETTER, 1, Reward.xp(50).plus(Reward.influence(30))),
                daily("daily.new_cards_2", MissionType.NEW_CARDS, 2, Reward.xp(50).plus(Reward.influence(25))),
                daily("daily.complete_quiz", MissionType.COMPLETE_QUIZ, 1, Reward.xp(50).plus(Reward.influence(25))),
                daily("daily.perfect_quiz", MissionType.PERFECT_QUIZ, 1, Reward.xp(80).plus(Reward.influence(40))),
                daily("daily.play_duel", MissionType.PLAY_DUEL, 1, Reward.xp(40).plus(Reward.influence(20))),
                daily("daily.win_duel", MissionType.WIN_DUEL, 1, Reward.xp(70).plus(Reward.influence(35))),
                daily("daily.recycle_3", MissionType.RECYCLE_CARDS, 3, Reward.xp(40).plus(Reward.influence(20)))));
        for (String continent : CONTINENTS) {
            dailyPool.add(new Template("daily.new_card_" + continent, Period.daily,
                    MissionType.NEW_CARDS_FROM_CONTINENT, continent, 1, Reward.xp(60).plus(Reward.influence(30))));
        }

        List<Template> weeklyPool = new ArrayList<>(List.of(
                weekly("weekly.open_7_packs", MissionType.OPEN_PACKS, 7, Reward.xp(250).plus(Reward.packs(1))),
                weekly("weekly.open_12_packs", MissionType.OPEN_PACKS, 12, Reward.xp(350).plus(Reward.packs(1))),
                weekly("weekly.pull_rare_5", MissionType.PULL_RARE_OR_BETTER, 5, Reward.xp(250).plus(Reward.influence(150))),
                weekly("weekly.new_cards_15", MissionType.NEW_CARDS, 15, Reward.xp(300).plus(Reward.packs(1))),
                weekly("weekly.complete_5_quizzes", MissionType.COMPLETE_QUIZ, 5, Reward.xp(250).plus(Reward.influence(150))),
                weekly("weekly.perfect_2_quizzes", MissionType.PERFECT_QUIZ, 2, Reward.xp(300).plus(Reward.packs(1))),
                weekly("weekly.play_5_duels", MissionType.PLAY_DUEL, 5, Reward.xp(250).plus(Reward.influence(150))),
                weekly("weekly.win_3_duels", MissionType.WIN_DUEL, 3, Reward.xp(300).plus(Reward.packs(1))),
                weekly("weekly.recycle_20", MissionType.RECYCLE_CARDS, 20, Reward.xp(200).plus(Reward.influence(200))),
                weekly("weekly.craft_1", MissionType.CRAFT_CARD, 1, Reward.xp(200).plus(Reward.influence(100)))));
        for (String continent : CONTINENTS) {
            weeklyPool.add(new Template("weekly.new_cards_" + continent, Period.weekly,
                    MissionType.NEW_CARDS_FROM_CONTINENT, continent, 5, Reward.xp(300).plus(Reward.packs(1))));
        }

        this.daily = List.copyOf(dailyPool);
        this.weekly = List.copyOf(weeklyPool);
        List<Template> all = new ArrayList<>(daily);
        all.addAll(weekly);
        this.byId = all.stream().collect(Collectors.toUnmodifiableMap(Template::id, Function.identity()));
    }

    public List<Template> pool(Period period) {
        return period == Period.daily ? daily : weekly;
    }

    public Optional<Template> find(String templateId) {
        return Optional.ofNullable(byId.get(templateId));
    }

    private static Template daily(String id, MissionType type, int target, Reward reward) {
        return new Template(id, Period.daily, type, null, target, reward);
    }

    private static Template weekly(String id, MissionType type, int target, Reward reward) {
        return new Template(id, Period.weekly, type, null, target, reward);
    }
}
