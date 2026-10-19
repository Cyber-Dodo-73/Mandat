package com.mandat.api.pack;

import com.mandat.api.common.config.OpenApiConfig;
import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import com.mandat.api.common.security.AuthenticatedUser;
import com.mandat.api.pack.dto.PackDtos.OddsResponse;
import com.mandat.api.pack.dto.PackDtos.OpenPackResponse;
import com.mandat.api.pack.dto.PackDtos.PacksResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/packs")
@Tag(name = "Packs")
@SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
public class PackController {

    static final String IDEMPOTENCY_HEADER = "Idempotency-Key";
    private static final int MAX_KEY_LENGTH = 128;

    private final PackService packService;
    private final PackOpenRateLimiter rateLimiter;

    public PackController(PackService packService, PackOpenRateLimiter rateLimiter) {
        this.packService = packService;
        this.rateLimiter = rateLimiter;
    }

    @GetMapping
    @Operation(summary = "Boosters of the season, free booster stock and timer, pity counters")
    public PacksResponse packs(@AuthenticationPrincipal AuthenticatedUser user) {
        return packService.overview(user.id());
    }

    @GetMapping("/{packId}/odds")
    @Operation(summary = "Exact odds of a booster (rarity per slot, finishes, pity rules)")
    public OddsResponse odds(@PathVariable String packId) {
        return packService.odds(packId);
    }

    @PostMapping("/{packId}/open")
    @Operation(
            summary = "Open a booster (server-side draw)",
            description = "Idempotent: replaying the same Idempotency-Key returns the same result without opening another booster.")
    public OpenPackResponse open(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable String packId,
            @Parameter(description = "Client-generated unique key (UUID recommended), max 128 characters")
            @RequestHeader(name = IDEMPOTENCY_HEADER, required = false) String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.isBlank() || idempotencyKey.length() > MAX_KEY_LENGTH) {
            throw new ApiException(ErrorCode.IDEMPOTENCY_KEY_REQUIRED, "A unique Idempotency-Key header is required");
        }
        rateLimiter.acquire(user.id());
        return packService.open(user.id(), packId, idempotencyKey);
    }
}
