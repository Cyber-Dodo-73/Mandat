package com.mandat.api.pack.draw;

import com.mandat.api.card.Rarity;
import java.util.List;

/** Boosters opened in a row without an epic+ (resp. legendary+) card. */
public record PityCounters(int packsSinceEpic, int packsSinceLegendary) {

    public static final PityCounters NONE = new PityCounters(0, 0);

    /** The booster about to be opened must contain at least this rarity, or null when pity does not apply. */
    public Rarity forcedMinimum() {
        if (packsSinceLegendary + 1 >= DrawOdds.LEGENDARY_PITY_PACKS) {
            return Rarity.LEGENDARY;
        }
        if (packsSinceEpic + 1 >= DrawOdds.EPIC_PITY_PACKS) {
            return Rarity.EPIC;
        }
        return null;
    }

    /**
     * Minimum rarity forced by the new-player guarantee for the booster about to be opened, given how
     * many boosters the player opened before. A player without any legendary+ so far has
     * {@code packsSinceLegendary == packsOpened}; the last booster of the window forces one.
     */
    public Rarity newPlayerMinimum(int packsOpened) {
        return withinNewPlayerWindow(packsOpened)
                        && packsOpened + 1 >= DrawOdds.NEW_PLAYER_LEGENDARY_WITHIN_PACKS
                ? Rarity.LEGENDARY
                : null;
    }

    /** Boosters left until the new-player legendary is guaranteed (1 = the next one), or null once it no longer applies. */
    public Integer newPlayerLegendaryIn(int packsOpened) {
        return withinNewPlayerWindow(packsOpened) ? DrawOdds.NEW_PLAYER_LEGENDARY_WITHIN_PACKS - packsOpened : null;
    }

    private boolean withinNewPlayerWindow(int packsOpened) {
        return packsOpened < DrawOdds.NEW_PLAYER_LEGENDARY_WITHIN_PACKS && packsSinceLegendary >= packsOpened;
    }

    public PityCounters after(List<Rarity> openedRarities) {
        boolean epic = openedRarities.stream().anyMatch(rarity -> rarity.isAtLeast(Rarity.EPIC));
        boolean legendary = openedRarities.stream().anyMatch(rarity -> rarity.isAtLeast(Rarity.LEGENDARY));
        return new PityCounters(epic ? 0 : packsSinceEpic + 1, legendary ? 0 : packsSinceLegendary + 1);
    }
}
