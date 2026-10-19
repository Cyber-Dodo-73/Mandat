package com.mandat.api.collection;

import com.mandat.api.card.CardFinish;
import com.mandat.api.card.Rarity;
import java.util.Map;

/**
 * Every Influence value of the game, in one place. Recycling is worth more than the automatic
 * duplicate bonus granted when a booster is opened; crafting a precise missing card costs about
 * 8 standard recycles of the same rarity.
 */
public final class EconomyRules {

    /** Influence for recycling one standard copy. */
    public static final Map<Rarity, Integer> RECYCLE_VALUE = Map.of(
            Rarity.COMMON, 5,
            Rarity.UNCOMMON, 10,
            Rarity.RARE, 25,
            Rarity.EPIC, 60,
            Rarity.LEGENDARY, 150,
            Rarity.MYTHIC, 400);

    /** Influence automatically granted when a booster gives a card the player already owns (standard). */
    public static final Map<Rarity, Integer> DUPLICATE_BONUS = Map.of(
            Rarity.COMMON, 1,
            Rarity.UNCOMMON, 2,
            Rarity.RARE, 5,
            Rarity.EPIC, 12,
            Rarity.LEGENDARY, 30,
            Rarity.MYTHIC, 80);

    /** Multiplier applied to recycle values and duplicate bonuses. */
    public static final Map<CardFinish, Integer> FINISH_MULTIPLIER = Map.of(
            CardFinish.STANDARD, 1,
            CardFinish.HOLO, 2,
            CardFinish.FULL_ART, 4,
            CardFinish.GOLD, 10);

    /** Influence to craft a missing card, standard finish only. */
    public static final Map<Rarity, Integer> CRAFT_COST = Map.of(
            Rarity.COMMON, 40,
            Rarity.UNCOMMON, 80,
            Rarity.RARE, 200,
            Rarity.EPIC, 500,
            Rarity.LEGENDARY, 1200,
            Rarity.MYTHIC, 3000);

    private EconomyRules() {}

    public static int recycleValue(Rarity rarity, CardFinish finish, int quantity) {
        return RECYCLE_VALUE.get(rarity) * FINISH_MULTIPLIER.get(finish) * quantity;
    }

    public static int duplicateBonus(Rarity rarity, CardFinish finish) {
        return DUPLICATE_BONUS.get(rarity) * FINISH_MULTIPLIER.get(finish);
    }
}
