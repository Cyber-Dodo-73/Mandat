package com.mandat.api.duel.dto;

import com.mandat.api.duel.engine.DuelAi.Difficulty;
import com.mandat.api.duel.engine.DuelEngine.RoundOutcome;
import com.mandat.api.duel.engine.DuelEngine.Winner;
import com.mandat.api.duel.engine.Domain;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class DuelDtos {

    private DuelDtos() {}

    public record CreateDuelRequest(
            @Schema(description = "3 distinct cards owned by the player")
            @NotNull @Size(min = 3, max = 3) List<@NotBlank String> cardIds,
            @NotNull Difficulty difficulty) {}

    public record PlayRoundRequest(@NotBlank String cardId) {}

    /** Full duel state; both teams are public, the card played each round stays secret until resolved. */
    public record DuelResponse(
            UUID id,
            Difficulty difficulty,
            @Schema(allowableValues = {"active", "finished", "abandoned"}) String status,
            List<String> playerCards,
            List<String> aiCards,
            List<String> playerCardsLeft,
            List<String> aiCardsLeft,
            int playerScore,
            int aiScore,
            int roundsPlayed,
            @Schema(nullable = true, description = "Domain of the next round, null once the duel is over") Domain nextDomain,
            List<RoundOutcome> rounds,
            @Schema(nullable = true) Winner winner,
            @Schema(nullable = true, description = "Granted when the duel finishes") DuelRewardDto reward,
            Instant createdAt) {}

    public record DuelRewardDto(
            int influence,
            @io.swagger.v3.oas.annotations.media.Schema(
                    description = "True when the daily cap of rewarded duel wins was already reached")
                    boolean capped) {}
}
