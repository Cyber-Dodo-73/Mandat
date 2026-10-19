package com.mandat.api.economy.dto;

import com.mandat.api.card.CardFinish;
import com.mandat.api.card.Rarity;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
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

    /** The player's remaining rewards for today and crafting allowance. */
    public record LimitsResponse(
            DailyCapDto quizRewards,
            DailyCapDto duelWinRewards,
            CraftAllowanceDto crafts,
            @Schema(description = "Start of the player's next local day, when daily caps reset") Instant dailyResetAt) {}

    public record DailyCapDto(int perDay, int used, int remaining) {}

    public record CraftAllowanceDto(
            int available,
            int max,
            int intervalHours,
            @Schema(nullable = true, description = "When the next craft is earned; null when the stock is full")
                    Instant nextAt) {}
}
