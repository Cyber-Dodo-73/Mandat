package com.mandat.api.pack.draw;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import com.mandat.api.card.CardFinish;
import com.mandat.api.card.Continent;
import com.mandat.api.card.Era;
import com.mandat.api.card.Rarity;
import com.mandat.api.pack.draw.PackDraw.DrawnCard;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.SplittableRandom;
import java.util.random.RandomGenerator;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class DrawEngineTest {

    private static final int PACKS = 100_000;

    /** 6 continents x 6 rarities x 2 cards, eras spread, a few sensitive cards. */
    static CardPool samplePool() {
        List<DrawCard> cards = new ArrayList<>();
        int n = 0;
        for (Continent continent : Continent.values()) {
            for (Rarity rarity : Rarity.values()) {
                for (int k = 0; k < 2; k++) {
                    Era era = Era.values()[(continent.ordinal() + rarity.ordinal() + k) % Era.values().length];
                    boolean sensitive = k == 1 && continent == Continent.EUROPE;
                    cards.add(new DrawCard("c" + n++, rarity, continent, era, sensitive));
                }
            }
        }
        return CardPool.of(cards);
    }

    @Test
    void observedRarityAndFinishRatesMatchPublishedOdds() {
        DrawEngine engine = new DrawEngine(new SplittableRandom(42));
        CardPool pool = samplePool();
        Map<Rarity, Integer> regular = new EnumMap<>(Rarity.class);
        Map<Rarity, Integer> guaranteed = new EnumMap<>(Rarity.class);
        Map<CardFinish, Integer> finishes = new EnumMap<>(CardFinish.class);
        int fullArtInRegularSlots = 0;

        for (int i = 0; i < PACKS; i++) {
            // No pity carried over: measures the base odds the app displays.
            List<DrawnCard> cards = engine.draw(pool, PityCounters.NONE).cards();
            for (int slot = 0; slot < cards.size(); slot++) {
                DrawnCard drawn = cards.get(slot);
                boolean last = slot == cards.size() - 1;
                (last ? guaranteed : regular).merge(drawn.card().rarity(), 1, Integer::sum);
                finishes.merge(drawn.finish(), 1, Integer::sum);
                if (!last && drawn.finish() == CardFinish.FULL_ART) {
                    fullArtInRegularSlots++;
                }
            }
        }

        DrawOdds.REGULAR_SLOT.forEach((rarity, percent) ->
                assertThat(percent(regular.getOrDefault(rarity, 0), PACKS * 4)).as("slots 1-4 %s", rarity)
                        .isCloseTo(percent, within(0.4)));
        assertThat(regular.keySet()).containsExactlyInAnyOrderElementsOf(DrawOdds.REGULAR_SLOT.keySet());
        DrawOdds.GUARANTEED_SLOT.forEach((rarity, percent) ->
                assertThat(percent(guaranteed.getOrDefault(rarity, 0), PACKS)).as("slot 5 %s", rarity)
                        .isCloseTo(percent, within(0.5)));

        int totalCards = PACKS * DrawOdds.CARDS_PER_PACK;
        assertThat(percent(finishes.get(CardFinish.GOLD), totalCards)).isCloseTo(DrawOdds.GOLD_CHANCE * 100, within(0.05));
        assertThat(percent(finishes.get(CardFinish.HOLO), totalCards)).isCloseTo(DrawOdds.HOLO_CHANCE * 100, within(0.2));
        // Full art: only slot 5, which is always rare or better.
        assertThat(percent(finishes.get(CardFinish.FULL_ART), PACKS)).isCloseTo(DrawOdds.FULL_ART_CHANCE * 100, within(0.2));
        assertThat(fullArtInRegularSlots).isZero();
    }

    @Test
    void finishOddsSumToOne() {
        for (Rarity rarity : Rarity.values()) {
            for (boolean guaranteed : new boolean[] {true, false}) {
                double sum = DrawOdds.finishOdds(rarity, guaranteed).values().stream().mapToDouble(Double::doubleValue).sum();
                assertThat(sum).isCloseTo(1.0, within(1e-9));
            }
        }
        assertThat(DrawOdds.finishOdds(Rarity.UNCOMMON, true).get(CardFinish.FULL_ART)).isZero();
    }

    @Test
    void epicPityTriggersOnTheTenthBoosterAndLegendaryOnTheFortieth() {
        // nextDouble() == 0 always picks the lowest weighted rarity: never an epic unless pity forces it.
        DrawEngine engine = new DrawEngine(new ConstantRandom());
        CardPool pool = samplePool();
        PityCounters pity = PityCounters.NONE;
        List<Rarity> bestPerPack = new ArrayList<>();
        for (int pack = 1; pack <= 80; pack++) {
            PackDraw draw = engine.draw(pool, pity);
            bestPerPack.add(draw.cards().stream().map(drawn -> drawn.card().rarity()).max(Rarity::compareTo).orElseThrow());
            pity = draw.pityAfter();
        }

        IntStream.rangeClosed(1, 80).forEach(pack -> {
            Rarity best = bestPerPack.get(pack - 1);
            if (pack % 40 == 0) {
                assertThat(best).as("booster %d", pack).isEqualTo(Rarity.LEGENDARY);
            } else if (pack % 10 == 0) {
                assertThat(best).as("booster %d", pack).isEqualTo(Rarity.EPIC);
            } else {
                assertThat(best).as("booster %d", pack).isEqualTo(Rarity.RARE);
            }
        });
    }

    @Test
    void pityCountersResetWhenTheRarityIsDrawn() {
        PityCounters counters = new PityCounters(5, 20);
        assertThat(counters.after(List.of(Rarity.COMMON, Rarity.RARE))).isEqualTo(new PityCounters(6, 21));
        assertThat(counters.after(List.of(Rarity.COMMON, Rarity.EPIC))).isEqualTo(new PityCounters(0, 21));
        assertThat(counters.after(List.of(Rarity.COMMON, Rarity.MYTHIC))).isEqualTo(new PityCounters(0, 0));
        assertThat(new PityCounters(8, 0).forcedMinimum()).isNull();
        assertThat(new PityCounters(9, 0).forcedMinimum()).isEqualTo(Rarity.EPIC);
        assertThat(new PityCounters(9, 39).forcedMinimum()).isEqualTo(Rarity.LEGENDARY);
    }

    @Test
    void continentBoosterDrawsFromItsContinentAndFallsBackWhenARarityIsMissing() {
        List<DrawCard> cards = new ArrayList<>();
        for (Rarity rarity : Rarity.values()) {
            cards.add(new DrawCard("eu-" + rarity, rarity, Continent.EUROPE, Era.MODERN, false));
            if (rarity != Rarity.MYTHIC) {
                cards.add(new DrawCard("oc-" + rarity, rarity, Continent.OCEANIA, Era.MODERN, false));
            }
        }
        CardPool oceania = CardPool.of(cards).restrictedTo(Continent.OCEANIA);
        assertThat(oceania.cards(Rarity.RARE)).extracting(DrawCard::continent).containsOnly(Continent.OCEANIA);
        assertThat(oceania.cards(Rarity.MYTHIC)).extracting(DrawCard::id).containsExactly("eu-MYTHIC");
    }

    @Test
    void firstPackFollowsTheOnboardingRules() {
        DrawEngine engine = new DrawEngine(new SplittableRandom(7));
        CardPool pool = samplePool();
        for (int i = 0; i < 2_000; i++) {
            List<DrawnCard> cards = engine.drawFirstPack(pool, FirstPackRules.DEFAULT, PityCounters.NONE).cards();
            assertThat(cards).hasSize(5);
            assertThat(cards.subList(0, 2)).allMatch(drawn -> drawn.card().rarity() == Rarity.COMMON);
            assertThat(cards.subList(2, 4)).allMatch(drawn ->
                    drawn.card().rarity() == Rarity.UNCOMMON || drawn.card().rarity() == Rarity.RARE);
            assertThat(cards.get(4).card().rarity()).isGreaterThanOrEqualTo(Rarity.EPIC);
            assertThat(cards).extracting(drawn -> drawn.card().continent()).doesNotHaveDuplicates();
            assertThat(cards.stream().map(drawn -> drawn.card().era()).distinct().count()).isGreaterThanOrEqualTo(3);
            assertThat(cards).noneMatch(drawn -> drawn.card().sensitive());
        }
    }

    @Test
    void firstPackFallsBackToARegularDrawWhenRulesCannotBeMet() {
        List<DrawCard> singleContinent = new ArrayList<>();
        for (Rarity rarity : Rarity.values()) {
            singleContinent.add(new DrawCard("x-" + rarity, rarity, Continent.ASIA, Era.MODERN, false));
        }
        DrawEngine engine = new DrawEngine(new SplittableRandom(1));
        PackDraw draw = engine.drawFirstPack(CardPool.of(singleContinent), FirstPackRules.DEFAULT, PityCounters.NONE);
        assertThat(draw.cards()).hasSize(5);
        assertThat(draw.cards().get(4).card().rarity()).isGreaterThanOrEqualTo(Rarity.RARE);
    }

    private static double percent(int count, int total) {
        return count * 100.0 / total;
    }

    /** Always returns the lowest value. */
    private static final class ConstantRandom implements RandomGenerator {
        @Override
        public long nextLong() {
            return 0;
        }

        @Override
        public double nextDouble() {
            return 0.0;
        }

        @Override
        public int nextInt(int bound) {
            return 0;
        }
    }
}
