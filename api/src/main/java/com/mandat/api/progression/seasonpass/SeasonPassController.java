package com.mandat.api.progression.seasonpass;

import com.mandat.api.common.config.OpenApiConfig;
import com.mandat.api.common.security.AuthenticatedUser;
import com.mandat.api.progression.ClaimResponse;
import com.mandat.api.progression.RewardDto;
import com.mandat.api.progression.seasonpass.SeasonPassService.SeasonPassState;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.stream.IntStream;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/season-pass")
@Tag(name = "Season pass", description = "Free season pass")
@SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
public class SeasonPassController {

    private final SeasonPassService seasonPass;
    private final SeasonPassCatalog catalog;
    private final Clock clock;

    public SeasonPassController(SeasonPassService seasonPass, SeasonPassCatalog catalog, Clock clock) {
        this.seasonPass = seasonPass;
        this.catalog = catalog;
        this.clock = clock;
    }

    @GetMapping
    @Operation(operationId = "getSeasonPass", summary = "Season pass tiers, season XP and claim state")
    public SeasonPassResponse getSeasonPass(@AuthenticationPrincipal AuthenticatedUser user) {
        SeasonPassState state = seasonPass.state(user.id());
        int reached = catalog.tierReached(state.seasonXp());
        List<TierDto> tiers = IntStream.rangeClosed(1, catalog.tiers())
                .mapToObj(tier -> {
                    boolean claimed = state.claimedTiers().contains(tier);
                    return new TierDto(tier, catalog.requiredXp(tier), RewardDto.from(catalog.rewardFor(tier)),
                            claimed, !claimed && tier <= reached);
                })
                .toList();
        return new SeasonPassResponse(catalog.seasonId(), state.seasonXp(), catalog.xpPerTier(), reached, tiers);
    }

    @PostMapping("/{tier}/claim")
    @Operation(operationId = "claimSeasonPassTier", summary = "Claim the reward of a reached tier")
    public ClaimResponse claimTier(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable int tier) {
        return ClaimResponse.from(seasonPass.claim(user.id(), tier, Instant.now(clock)));
    }

    public record SeasonPassResponse(String seasonId, int seasonXp, int xpPerTier, int currentTier, List<TierDto> tiers) {}

    public record TierDto(int tier, int requiredXp, RewardDto reward, boolean claimed, boolean claimable) {}
}
