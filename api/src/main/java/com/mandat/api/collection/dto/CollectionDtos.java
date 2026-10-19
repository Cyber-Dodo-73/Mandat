package com.mandat.api.collection.dto;

import com.mandat.api.card.CardFinish;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;

public final class CollectionDtos {

    private CollectionDtos() {}

    public record CollectionResponse(
            List<OwnedCardDto> items,
            @Schema(description = "Distinct catalog cards owned, any finish") int distinctCards,
            int totalCopies) {}

    public record OwnedCardDto(
            String cardId, CardFinish finish, int quantity, Instant firstObtainedAt, Instant lastObtainedAt) {}

    public record RecycleRequest(
            @NotNull CardFinish finish,
            @Schema(description = "Copies to recycle; at least one copy of this finish is always kept")
            @Min(1) @Max(999) int quantity) {}

    public record RecycleResponse(
            String cardId, CardFinish finish, int remainingQuantity, int influenceGained, int influenceBalance) {}

    public record CraftResponse(String cardId, CardFinish finish, int influenceSpent, int influenceBalance) {}

    public record UpgradeRequest(
            @Schema(description = "Only standard is upgradable") @NotNull CardFinish from,
            @Schema(description = "Only holo is on sale") @NotNull CardFinish to) {}

    public record UpgradeResponse(
            String cardId,
            CardFinish from,
            CardFinish to,
            int influenceSpent,
            int influenceBalance,
            @Schema(description = "Standard copies left (the upgraded copy is removed from them)") int remainingFrom,
            @Schema(description = "Holo copies owned after the upgrade") int quantityTo) {}
}
