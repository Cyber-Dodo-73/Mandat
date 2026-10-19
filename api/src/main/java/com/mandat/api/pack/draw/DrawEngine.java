package com.mandat.api.pack.draw;

import com.mandat.api.card.CardFinish;
import com.mandat.api.card.Continent;
import com.mandat.api.card.Era;
import com.mandat.api.card.Rarity;
import com.mandat.api.pack.draw.PackDraw.DrawnCard;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.random.RandomGenerator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Booster draw engine. Pure logic: no persistence, the randomness source is injected so tests can
 * drive it. Rarity and finish odds come from {@link DrawOdds}.
 */
@Component
public class DrawEngine {

    private static final Logger log = LoggerFactory.getLogger(DrawEngine.class);
    private static final int FIRST_PACK_ATTEMPTS = 500;

    private final RandomGenerator random;

    public DrawEngine(RandomGenerator random) {
        this.random = random;
    }

    /** Regular booster: slots 1-4 from {@link DrawOdds#REGULAR_SLOT}, slot 5 guaranteed rare+ with pity. */
    public PackDraw draw(CardPool pool, PityCounters pity) {
        return draw(pool, pity, null);
    }

    /**
     * Regular booster with an extra minimum for slot 5 (e.g. the new-player guarantee); the higher of
     * that minimum and the pity's applies.
     */
    public PackDraw draw(CardPool pool, PityCounters pity, Rarity extraMinimum) {
        List<DrawnCard> cards = new ArrayList<>(DrawOdds.CARDS_PER_PACK);
        for (int slot = 0; slot < DrawOdds.CARDS_PER_PACK - 1; slot++) {
            cards.add(drawCard(pool, pickRarity(DrawOdds.REGULAR_SLOT), false));
        }
        Rarity forced = higher(pity.forcedMinimum(), extraMinimum);
        Map<Rarity, Double> lastSlot = forced == null ? DrawOdds.GUARANTEED_SLOT : DrawOdds.guaranteedSlotAtLeast(forced);
        cards.add(drawCard(pool, pickRarity(lastSlot), true));
        return new PackDraw(List.copyOf(cards), pity.after(rarities(cards)));
    }

    /**
     * Onboarding booster: rarities per {@link FirstPackRules} slot group, cards spread over distinct
     * continents and eras, sensitive figures excluded. Whatever the group order in the rules file, the
     * cards are laid out by ascending rarity so the best one (epic or better) is slot 5, and that card
     * is at least {@link DrawOdds#FIRST_PACK_BEST_FINISH}. Falls back to a regular draw if the catalog
     * cannot satisfy the rules.
     */
    public PackDraw drawFirstPack(CardPool pool, FirstPackRules rules, PityCounters pity) {
        for (int attempt = 0; attempt < FIRST_PACK_ATTEMPTS; attempt++) {
            List<DrawnCard> cards = tryFirstPack(pool, rules);
            if (cards != null) {
                return new PackDraw(List.copyOf(cards), pity.after(rarities(cards)));
            }
        }
        log.warn("Catalog cannot satisfy the first booster rules, falling back to a regular draw");
        return draw(pool, pity);
    }

    private List<DrawnCard> tryFirstPack(CardPool pool, FirstPackRules rules) {
        List<DrawnCard> cards = new ArrayList<>(rules.cardCount());
        Set<Continent> continents = EnumSet.noneOf(Continent.class);
        Set<Era> eras = EnumSet.noneOf(Era.class);
        for (FirstPackRules.SlotGroup group : rules.slots()) {
            for (int i = 0; i < group.count(); i++) {
                Rarity rarity = pickRarity(groupWeights(group));
                boolean needNewContinent = continents.size() < rules.distinctContinents();
                List<DrawCard> candidates = pool.cards(rarity).stream()
                        .filter(card -> !rules.excludeSensitive() || !card.sensitive())
                        .filter(card -> !needNewContinent || !continents.contains(card.continent()))
                        .filter(card -> cards.stream().noneMatch(drawn -> drawn.card().id().equals(card.id())))
                        .toList();
                if (candidates.isEmpty()) {
                    return null;
                }
                DrawCard card = candidates.get(random.nextInt(candidates.size()));
                continents.add(card.continent());
                eras.add(card.era());
                cards.add(new DrawnCard(card, CardFinish.STANDARD));
            }
        }
        if (eras.size() < rules.minDistinctEras()) {
            return null;
        }
        // Stable sort: the best card ends in slot 5 and finishes are rolled for the final layout.
        cards.sort(Comparator.comparing(drawn -> drawn.card().rarity()));
        List<DrawnCard> laidOut = new ArrayList<>(cards.size());
        for (int slot = 0; slot < cards.size(); slot++) {
            DrawCard card = cards.get(slot).card();
            boolean lastSlot = slot == cards.size() - 1;
            CardFinish finish = rollFinish(card.rarity(), lastSlot);
            if (lastSlot && card.rarity().isAtLeast(Rarity.EPIC) && finish == CardFinish.STANDARD) {
                finish = DrawOdds.FIRST_PACK_BEST_FINISH;
            }
            laidOut.add(new DrawnCard(card, finish));
        }
        return laidOut;
    }

    private static Rarity higher(Rarity a, Rarity b) {
        if (a == null) {
            return b;
        }
        if (b == null) {
            return a;
        }
        return a.isAtLeast(b) ? a : b;
    }

    /** Within a first-pack group, rarities keep their relative weights from the regular odds. */
    private static Map<Rarity, Double> groupWeights(FirstPackRules.SlotGroup group) {
        EnumMap<Rarity, Double> weights = new EnumMap<>(Rarity.class);
        for (Rarity rarity : group.rarities()) {
            Double weight = DrawOdds.GUARANTEED_SLOT.getOrDefault(rarity, DrawOdds.REGULAR_SLOT.get(rarity));
            weights.put(rarity, weight == null ? 1.0 : weight);
        }
        return weights;
    }

    private DrawnCard drawCard(CardPool pool, Rarity rarity, boolean guaranteedSlot) {
        List<DrawCard> candidates = pool.cards(rarity);
        if (candidates.isEmpty()) {
            throw new IllegalStateException("No card of rarity " + rarity + " in the draw pool");
        }
        DrawCard card = candidates.get(random.nextInt(candidates.size()));
        return new DrawnCard(card, rollFinish(rarity, guaranteedSlot));
    }

    Rarity pickRarity(Map<Rarity, Double> weights) {
        double total = weights.values().stream().mapToDouble(Double::doubleValue).sum();
        double roll = random.nextDouble() * total;
        Rarity last = null;
        for (Map.Entry<Rarity, Double> entry : weights.entrySet()) {
            last = entry.getKey();
            roll -= entry.getValue();
            if (roll < 0) {
                return last;
            }
        }
        return last;
    }

    /** One roll per card, thresholds stacked in the order gold, full art, holo, standard. */
    CardFinish rollFinish(Rarity rarity, boolean guaranteedSlot) {
        double roll = random.nextDouble();
        Map<CardFinish, Double> odds = DrawOdds.finishOdds(rarity, guaranteedSlot);
        for (CardFinish finish : List.of(CardFinish.GOLD, CardFinish.FULL_ART, CardFinish.HOLO)) {
            roll -= odds.get(finish);
            if (roll < 0) {
                return finish;
            }
        }
        return CardFinish.STANDARD;
    }

    private static List<Rarity> rarities(List<DrawnCard> cards) {
        return cards.stream().map(drawn -> drawn.card().rarity()).toList();
    }
}
