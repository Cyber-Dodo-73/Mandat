package com.mandat.api.pack.draw;

import com.mandat.api.card.CardFinish;
import com.mandat.api.card.Rarity;
import java.util.Collections;
import java.util.EnumMap;
import java.util.Map;

/**
 * Single source of truth for booster odds. {@code GET /packs/{id}/odds} publishes exactly these
 * values and the statistical tests check the engine against them.
 */
public final class DrawOdds {

    public static final int CARDS_PER_PACK = 5;

    /** Slots 1 to 4, in percent. */
    public static final Map<Rarity, Double> REGULAR_SLOT = weights(
            Rarity.COMMON, 65.0, Rarity.UNCOMMON, 25.0, Rarity.RARE, 10.0);

    /** Slot 5, guaranteed rare or better, in percent. */
    public static final Map<Rarity, Double> GUARANTEED_SLOT = weights(
            Rarity.RARE, 70.0, Rarity.EPIC, 22.0, Rarity.LEGENDARY, 7.0, Rarity.MYTHIC, 1.0);

    /** At least one epic or better every N boosters: the Nth booster without one forces slot 5. */
    public static final int EPIC_PITY_PACKS = 10;

    /** At least one legendary or better every N boosters. */
    public static final int LEGENDARY_PITY_PACKS = 40;

    /**
     * New-player guarantee, independent from the 40-booster pity: a player who has not pulled a
     * legendary or better in their first boosters gets one in this booster at the latest.
     */
    public static final int NEW_PLAYER_LEGENDARY_WITHIN_PACKS = 3;

    /** The onboarding booster's best card (epic or better, slot 5) is at least this finish. */
    public static final CardFinish FIRST_PACK_BEST_FINISH = CardFinish.HOLO;

    /** Per drawn card, any rarity, any slot. */
    public static final double GOLD_CHANCE = 0.003;

    /** Per drawn card, slot 5 only, rarity {@link #FULL_ART_MIN_RARITY} or better. */
    public static final double FULL_ART_CHANCE = 0.03;

    public static final Rarity FULL_ART_MIN_RARITY = Rarity.RARE;

    /** Per drawn card, any rarity, any slot. */
    public static final double HOLO_CHANCE = 0.08;

    private DrawOdds() {}

    /** Probability of each finish for a card of this rarity in this slot (sums to 1). */
    public static Map<CardFinish, Double> finishOdds(Rarity rarity, boolean guaranteedSlot) {
        EnumMap<CardFinish, Double> odds = new EnumMap<>(CardFinish.class);
        double fullArt = fullArtEligible(rarity, guaranteedSlot) ? FULL_ART_CHANCE : 0.0;
        odds.put(CardFinish.GOLD, GOLD_CHANCE);
        odds.put(CardFinish.FULL_ART, fullArt);
        odds.put(CardFinish.HOLO, HOLO_CHANCE);
        odds.put(CardFinish.STANDARD, 1.0 - GOLD_CHANCE - fullArt - HOLO_CHANCE);
        return Collections.unmodifiableMap(odds);
    }

    public static boolean fullArtEligible(Rarity rarity, boolean guaranteedSlot) {
        return guaranteedSlot && rarity.isAtLeast(FULL_ART_MIN_RARITY);
    }

    /** Guaranteed-slot weights restricted to {@code minimum} or better (used by pity). */
    public static Map<Rarity, Double> guaranteedSlotAtLeast(Rarity minimum) {
        EnumMap<Rarity, Double> restricted = new EnumMap<>(Rarity.class);
        GUARANTEED_SLOT.forEach((rarity, weight) -> {
            if (rarity.isAtLeast(minimum)) {
                restricted.put(rarity, weight);
            }
        });
        return Collections.unmodifiableMap(restricted);
    }

    private static Map<Rarity, Double> weights(Object... pairs) {
        EnumMap<Rarity, Double> map = new EnumMap<>(Rarity.class);
        for (int i = 0; i < pairs.length; i += 2) {
            map.put((Rarity) pairs[i], (Double) pairs[i + 1]);
        }
        return Collections.unmodifiableMap(map);
    }
}
