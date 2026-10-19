package com.mandat.api.collection;

import com.mandat.api.card.CardFinish;
import com.mandat.api.card.Rarity;
import java.util.Map;

/**
 * Recycling, duplicate and crafting values, in one place (exposed read-only by GET /api/v1/economy).
 * Rule since 2026-10-19 (docs/TCG_REVIEW.md §3.4, docs/BUSINESS.md): "10 duplicates of a rarity =
 * 1 craft of that rarity" (recycle value = craft cost / 10), finish multipliers apply to recycling
 * only, and the crafting pace (about one card every two days) is set by the server-side allowance
 * in {@code economy.RewardLimits}, not by starving the player of Influence.
 */
public final class EconomyRules {

    /** Influence for recycling one standard copy. */
    public static final Map<Rarity, Integer> RECYCLE_VALUE = Map.of(
            Rarity.COMMON, 10,
            Rarity.UNCOMMON, 20,
            Rarity.RARE, 50,
            Rarity.EPIC, 120,
            Rarity.LEGENDARY, 300,
            Rarity.MYTHIC, 800);

    /** Influence automatically granted when a booster gives a card the player already owns (any finish). */
    public static final Map<Rarity, Integer> DUPLICATE_BONUS = Map.of(
            Rarity.COMMON, 2,
            Rarity.UNCOMMON, 4,
            Rarity.RARE, 10,
            Rarity.EPIC, 25,
            Rarity.LEGENDARY, 60,
            Rarity.MYTHIC, 150);

    /** Multiplier applied to recycle values (gold ×5: keeping the rarest object must stay worth more). */
    public static final Map<CardFinish, Integer> FINISH_MULTIPLIER = Map.of(
            CardFinish.STANDARD, 1,
            CardFinish.HOLO, 2,
            CardFinish.FULL_ART, 4,
            CardFinish.GOLD, 5);

    /** Influence to craft a missing card, standard finish only. */
    public static final Map<Rarity, Integer> CRAFT_COST = Map.of(
            Rarity.COMMON, 100,
            Rarity.UNCOMMON, 200,
            Rarity.RARE, 500,
            Rarity.EPIC, 1200,
            Rarity.LEGENDARY, 3000,
            Rarity.MYTHIC, 8000);

    private EconomyRules() {}

    public static int recycleValue(Rarity rarity, CardFinish finish, int quantity) {
        return RECYCLE_VALUE.get(rarity) * FINISH_MULTIPLIER.get(finish) * quantity;
    }

    /** The duplicate bonus is flat: the finish is rewarded when the copy is recycled. */
    public static int duplicateBonus(Rarity rarity, CardFinish finish) {
        return DUPLICATE_BONUS.get(rarity);
    }
}
