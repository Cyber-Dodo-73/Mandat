package com.mandat.api.duel.engine;

import static com.mandat.api.support.TestCards.card;
import static org.assertj.core.api.Assertions.assertThat;

import com.mandat.api.card.AbilityEffect;
import com.mandat.api.card.AbilityEffect.ConditionKind;
import com.mandat.api.card.AbilityEffect.Stat;
import com.mandat.api.card.AbilityEffect.Type;
import com.mandat.api.card.Card;
import com.mandat.api.card.Continent;
import com.mandat.api.card.Rarity;
import com.mandat.api.duel.engine.DuelAi.Difficulty;
import com.mandat.api.duel.engine.DuelEngine.RoundOutcome;
import com.mandat.api.duel.engine.DuelEngine.Winner;
import java.util.ArrayList;
import java.util.List;
import java.util.random.RandomGenerator;
import java.util.random.RandomGeneratorFactory;
import org.junit.jupiter.api.Test;

class DuelAiTest {

    static RandomGenerator seeded(long seed) {
        return RandomGeneratorFactory.of("L64X128MixRandom").create(seed);
    }

    /** 60 varied cards: totals from 12 to 30, different strengths and effects. */
    static List<Card> pool() {
        RandomGenerator random = seeded(7);
        List<Card> cards = new ArrayList<>();
        AbilityEffect[] effects = {
            new AbilityEffect(Type.BONUS, Stat.ANY, 1, ConditionKind.ALWAYS, null),
            new AbilityEffect(Type.BONUS, Stat.ANY, 2, ConditionKind.BEHIND, null),
            new AbilityEffect(Type.MALUS, Stat.ANY, 1, ConditionKind.OPPONENT_RARITY_HIGHER, null),
            new AbilityEffect(Type.TIE_BREAKER, null, null, ConditionKind.ALWAYS, null),
        };
        Continent[] continents = Continent.values();
        Rarity[] rarities = Rarity.values();
        for (int i = 0; i < 60; i++) {
            cards.add(card("c" + i)
                    .stats(1 + random.nextInt(10), 1 + random.nextInt(10), 1 + random.nextInt(10), 1 + random.nextInt(10))
                    .continent(continents[i % continents.length])
                    .rarity(rarities[i % rarities.length])
                    .effect(effects[i % effects.length])
                    .build());
        }
        return cards;
    }

    @Test
    void teamNeverReusesThePlayersCardsAndFollowsDifficulty() {
        List<Card> pool = pool();
        List<Card> player = List.of(pool.get(0), pool.get(1), pool.get(2));
        double playerAverage = player.stream().mapToInt(Domain::total).average().orElseThrow();
        double easySum = 0;
        double hardSum = 0;
        for (int seed = 0; seed < 200; seed++) {
            List<Card> easy = DuelAi.pickTeam(Difficulty.EASY, player, pool, seeded(seed));
            List<Card> hard = DuelAi.pickTeam(Difficulty.HARD, player, pool, seeded(seed));
            assertThat(easy).hasSize(3).doesNotContainAnyElementsOf(player).doesNotHaveDuplicates();
            assertThat(hard).hasSize(3).doesNotContainAnyElementsOf(player).doesNotHaveDuplicates();
            easySum += easy.stream().mapToInt(Domain::total).average().orElseThrow();
            hardSum += hard.stream().mapToInt(Domain::total).average().orElseThrow();
        }
        assertThat(easySum / 200).isLessThan(playerAverage);
        assertThat(hardSum / 200).isGreaterThan(easySum / 200);
    }

    @Test
    void sameSeedSameTeam() {
        List<Card> pool = pool();
        List<Card> player = List.of(pool.get(3), pool.get(4), pool.get(5));
        assertThat(DuelAi.pickTeam(Difficulty.NORMAL, player, pool, seeded(42)))
                .isEqualTo(DuelAi.pickTeam(Difficulty.NORMAL, player, pool, seeded(42)));
    }

    @Test
    void normalPlaysItsBestStatInTheDomain() {
        Card weak = card("w").stats(2, 2, 2, 2).build();
        Card strong = card("s").stats(1, 1, 1, 9).build();
        Card chosen = DuelAi.chooseCard(Difficulty.NORMAL, List.of(weak, strong), List.of(card("p").build()),
                Domain.STRATEGY, 1, 0, 0, seeded(1));
        assertThat(chosen).isEqualTo(strong);
    }

    @Test
    void hardSavesStrongCardsWhenAWeakerOneWinsAnyway() {
        Card enough = card("e").stats(7, 7, 7, 7).build();
        Card overkill = card("o").stats(10, 10, 10, 10).build();
        Card chosen = DuelAi.chooseCard(Difficulty.HARD, List.of(overkill, enough), List.of(card("p").stats(3, 3, 3, 3).build()),
                Domain.INFLUENCE, 1, 0, 0, seeded(1));
        assertThat(chosen).isEqualTo(enough);
    }

    @Test
    void harderAiWinsMoreOftenAgainstTheSameRandomPlayer() {
        List<Card> pool = pool();
        double easy = winRate(Difficulty.EASY, pool);
        double normal = winRate(Difficulty.NORMAL, pool);
        double hard = winRate(Difficulty.HARD, pool);
        assertThat(normal).isGreaterThan(easy);
        assertThat(hard).isGreaterThanOrEqualTo(normal - 0.02);
    }

    /** Share of duels won by the AI against a player choosing teams and cards at random. */
    private static double winRate(Difficulty difficulty, List<Card> pool) {
        int aiWins = 0;
        int duels = 2000;
        for (int seed = 0; seed < duels; seed++) {
            RandomGenerator random = seeded(seed);
            List<Card> shuffled = new ArrayList<>(pool);
            List<Card> player = new ArrayList<>();
            for (int i = 0; i < 3; i++) {
                player.add(shuffled.remove(random.nextInt(shuffled.size())));
            }
            List<Card> ai = new ArrayList<>(DuelAi.pickTeam(Difficulty.NORMAL, player, pool, random));
            List<Card> hand = new ArrayList<>(player);
            int playerScore = 0;
            int aiScore = 0;
            for (int round = 1; round <= 3 && playerScore < 2 && aiScore < 2; round++) {
                Domain domain = Domain.values()[random.nextInt(4)];
                Card aiCard = DuelAi.chooseCard(difficulty, ai, hand, domain, round, playerScore, aiScore, random);
                Card playerCard = hand.remove(random.nextInt(hand.size()));
                ai.remove(aiCard);
                RoundOutcome outcome = DuelEngine.resolve(playerCard, aiCard, domain, round, playerScore, aiScore);
                if (outcome.winner() == Winner.PLAYER) {
                    playerScore++;
                } else if (outcome.winner() == Winner.AI) {
                    aiScore++;
                }
            }
            if (aiScore > playerScore) {
                aiWins++;
            }
        }
        return aiWins / (double) duels;
    }
}
