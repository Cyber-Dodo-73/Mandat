package com.mandat.api.collection.dto;

import com.mandat.api.card.CardFinish;
import com.mandat.api.card.Rarity;
import java.util.List;

public final class EconomyDtos {

    private EconomyDtos() {}

    /** Crafting and recycling rules, so the app previews exactly what the server will apply. */
    public record EconomyResponse(
            List<RarityValuesDto> rarities,
            List<FinishMultiplierDto> finishes,
            CardFinish craftFinish,
            int keptCopiesWhenRecycling) {}

    /**
     * Values for one rarity, before the finish multiplier. Recycling one copy of a finish yields
     * {@code recycleValue × multiplier}; a duplicate drawn from a booster grants
     * {@code duplicateBonus × multiplier}; crafting a missing card (standard finish) costs {@code craftCost}.
     */
    public record RarityValuesDto(Rarity rarity, int craftCost, int recycleValue, int duplicateBonus) {}

    public record FinishMultiplierDto(CardFinish finish, int multiplier) {}
}
