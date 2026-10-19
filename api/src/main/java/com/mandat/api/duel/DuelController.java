package com.mandat.api.duel;

import com.mandat.api.common.config.OpenApiConfig;
import com.mandat.api.common.security.AuthenticatedUser;
import com.mandat.api.duel.dto.DuelDtos.CreateDuelRequest;
import com.mandat.api.duel.dto.DuelDtos.DuelResponse;
import com.mandat.api.duel.dto.DuelDtos.PlayRoundRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/duels")
@Tag(name = "Duels")
@SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
public class DuelController {

    private final DuelService duelService;

    public DuelController(DuelService duelService) {
        this.duelService = duelService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(
            summary = "Start a duel against the AI",
            description = "Takes 3 owned cards; the AI picks its team. Starting a duel abandons the previous active one.")
    public DuelResponse create(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody CreateDuelRequest request) {
        return duelService.create(user.id(), request);
    }

    @GetMapping("/{duelId}")
    @Operation(summary = "Current state of a duel")
    public DuelResponse get(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID duelId) {
        return duelService.get(user.id(), duelId);
    }

    @PostMapping("/{duelId}/rounds")
    @Operation(
            summary = "Play the next round",
            description = "The server resolves the round in the announced domain (abilities included) and returns the "
                    + "full state; the duel ends at 2 wins or after 3 rounds.")
    public DuelResponse playRound(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID duelId,
            @Valid @RequestBody PlayRoundRequest request) {
        return duelService.playRound(user.id(), duelId, request.cardId());
    }
}
