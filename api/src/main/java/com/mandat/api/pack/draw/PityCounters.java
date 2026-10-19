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

    public PityCounters after(List<Rarity> openedRarities) {
        boolean epic = openedRarities.stream().anyMatch(rarity -> rarity.isAtLeast(Rarity.EPIC));
        boolean legendary = openedRarities.stream().anyMatch(rarity -> rarity.isAtLeast(Rarity.LEGENDARY));
        return new PityCounters(epic ? 0 : packsSinceEpic + 1, legendary ? 0 : packsSinceLegendary + 1);
    }
}
