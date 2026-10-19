package com.mandat.api.collection;

import com.mandat.api.card.CardFinish;
import com.mandat.api.card.Rarity;
import java.util.Map;

/**
 * Recycling, duplicate and crafting values, in one place (exposed read-only by GET /api/v1/economy).
 * Tuned on 2026-10-19 so that an active free player crafts about one card every two days
 * (scripts/economy/simulate.py, scenario "rebalanced"; see docs/BUSINESS.md): a craft costs roughly
 * two days of Influence income, recycling stays the main source (a craft ≈ 60–90 standard recycles
 * of the same rarity) and the automatic duplicate bonus is a small extra from uncommon up.
 */
public final class EconomyRules {

    /** Influence for recycling one standard copy. */
    public static final Map<Rarity, Integer> RECYCLE_VALUE = Map.of(
            Rarity.COMMON, 3,
            Rarity.UNCOMMON, 6,
            Rarity.RARE, 15,
            Rarity.EPIC, 40,
            Rarity.LEGENDARY, 100,
            Rarity.MYTHIC, 300);

    /** Influence automatically granted when a booster gives a card the player already owns (standard). */
    public static final Map<Rarity, Integer> DUPLICATE_BONUS = Map.of(
            Rarity.COMMON, 0,
            Rarity.UNCOMMON, 1,
            Rarity.RARE, 2,
            Rarity.EPIC, 5,
            Rarity.LEGENDARY, 12,
            Rarity.MYTHIC, 30);

    /** Multiplier applied to recycle values and duplicate bonuses. */
    public static final Map<CardFinish, Integer> FINISH_MULTIPLIER = Map.of(
            CardFinish.STANDARD, 1,
            CardFinish.HOLO, 2,
            CardFinish.FULL_ART, 4,
            CardFinish.GOLD, 10);

    /** Influence to craft a missing card, standard finish only. */
    public static final Map<Rarity, Integer> CRAFT_COST = Map.of(
            Rarity.COMMON, 250,
            Rarity.UNCOMMON, 350,
            Rarity.RARE, 700,
            Rarity.EPIC, 1500,
            Rarity.LEGENDARY, 3500,
            Rarity.MYTHIC, 9000);

    private EconomyRules() {}

    public static int recycleValue(Rarity rarity, CardFinish finish, int quantity) {
        return RECYCLE_VALUE.get(rarity) * FINISH_MULTIPLIER.get(finish) * quantity;
    }

    public static int duplicateBonus(Rarity rarity, CardFinish finish) {
        return DUPLICATE_BONUS.get(rarity) * FINISH_MULTIPLIER.get(finish);
    }
}
