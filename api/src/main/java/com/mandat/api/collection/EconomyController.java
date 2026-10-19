package com.mandat.api.collection;

import com.mandat.api.card.CardFinish;
import com.mandat.api.card.Rarity;
import com.mandat.api.collection.dto.EconomyDtos.EconomyResponse;
import com.mandat.api.collection.dto.EconomyDtos.FinishMultiplierDto;
import com.mandat.api.collection.dto.EconomyDtos.RarityValuesDto;
import com.mandat.api.common.config.OpenApiConfig;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Duration;
import java.util.Arrays;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Read-only view of {@link EconomyRules}: the single source of truth for craft and recycle values. */
@RestController
@RequestMapping("/api/v1/economy")
@Tag(name = "Collection")
@SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
public class EconomyController {

    static final EconomyResponse RULES = new EconomyResponse(
            Arrays.stream(Rarity.values())
                    .map(rarity -> new RarityValuesDto(
                            rarity,
                            EconomyRules.CRAFT_COST.get(rarity),
                            EconomyRules.RECYCLE_VALUE.get(rarity),
                            EconomyRules.DUPLICATE_BONUS.get(rarity)))
                    .toList(),
            Arrays.stream(CardFinish.values())
                    .map(finish -> new FinishMultiplierDto(finish, EconomyRules.FINISH_MULTIPLIER.get(finish)))
                    .toList(),
            CardFinish.STANDARD,
            1);

    @GetMapping
    @Operation(summary = "Craft costs, recycle values and duplicate bonuses per rarity and finish")
    public ResponseEntity<EconomyResponse> economy() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePrivate())
                .body(RULES);
    }
}
