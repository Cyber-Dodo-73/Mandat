package com.mandat.api.pack.draw;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.mandat.api.card.Rarity;
import java.util.List;

/**
 * Composition of the onboarding booster (the player's very first one), loaded from
 * {@code data/firstPackRules.json} when present. Group order doesn't matter: the engine lays the
 * cards out by ascending rarity, so the best one is always slot 5 like a regular booster's.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record FirstPackRules(
        List<SlotGroup> slots, int distinctContinents, int minDistinctEras, boolean excludeSensitive) {

    public static final FirstPackRules DEFAULT = new FirstPackRules(
            List.of(
                    new SlotGroup(List.of(Rarity.COMMON), 2),
                    new SlotGroup(List.of(Rarity.UNCOMMON, Rarity.RARE), 2),
                    new SlotGroup(List.of(Rarity.EPIC, Rarity.LEGENDARY, Rarity.MYTHIC), 1)),
            5,
            3,
            true);

    public int cardCount() {
        return slots.stream().mapToInt(SlotGroup::count).sum();
    }

    public boolean isValid() {
        return slots != null && !slots.isEmpty()
                && slots.stream().allMatch(group -> group.rarities() != null && !group.rarities().isEmpty()
                        && group.count() > 0)
                && cardCount() == DrawOdds.CARDS_PER_PACK
                && distinctContinents >= 0 && distinctContinents <= DrawOdds.CARDS_PER_PACK
                && minDistinctEras >= 0 && minDistinctEras <= DrawOdds.CARDS_PER_PACK;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SlotGroup(List<Rarity> rarities, int count) {}
}
