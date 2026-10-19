package com.mandat.api.pack.dto;

import com.mandat.api.card.CardFinish;
import com.mandat.api.card.Continent;
import com.mandat.api.card.Rarity;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class PackDtos {

    private PackDtos() {}

    public record PacksResponse(List<PackDto> packs, FreePacksDto freePacks, int bonusPacks, PityDto pity) {}

    public record PackDto(
            String id,
            @Schema(nullable = true, description = "Null for the standard booster") Continent continent,
            int requiredLevel,
            boolean unlocked) {}

    public record FreePacksDto(
            int available,
            int max,
            @Schema(nullable = true, description = "Server time of the next free booster; null when the stock is full")
            Instant nextAt,
            long intervalSeconds) {}

    public record PityDto(
            int packsSinceEpic,
            @Schema(description = "Boosters left until an epic or better is guaranteed (1 = the next one)")
            int epicGuaranteedIn,
            int packsSinceLegendary,
            int legendaryGuaranteedIn) {}

    public record OddsResponse(
            String packId,
            List<SlotOddsDto> slots,
            List<FinishOddsDto> finishes,
            PityRulesDto pity,
            @Schema(description = "Themed booster: a rarity without any card of the continent is drawn from the whole season")
            boolean continentFallback) {}

    public record SlotOddsDto(@Schema(description = "1-based slot numbers") List<Integer> slots, List<RarityOddsDto> rarities) {}

    public record RarityOddsDto(Rarity rarity, @Schema(description = "Percent") double percent) {}

    public record FinishOddsDto(
            CardFinish finish,
            @Schema(description = "Percent, per drawn card") double percent,
            @Schema(description = "Only the guaranteed slot (5) can roll this finish") boolean guaranteedSlotOnly,
            @Schema(nullable = true, description = "Minimum rarity eligible for this finish") Rarity minRarity) {}

    public record PityRulesDto(int epicEveryPacks, int legendaryEveryPacks) {}

    public record OpenPackResponse(
            UUID openingId,
            String packId,
            List<DrawnCardDto> cards,
            @Schema(description = "Influence granted for duplicates in this booster") int influenceGained,
            boolean firstPack,
            PityDto pity,
            FreePacksDto freePacks,
            int bonusPacks,
            Instant openedAt) {}

    public record DrawnCardDto(
            @Schema(description = "1-based slot, 5 is the guaranteed rare-or-better slot") int slot,
            String cardId,
            Rarity rarity,
            CardFinish finish,
            @Schema(description = "The player owned no copy of this card before") boolean isNew,
            @Schema(description = "The player owned no copy of this card in this finish before") boolean isNewFinish,
            int influenceGained) {}
}
