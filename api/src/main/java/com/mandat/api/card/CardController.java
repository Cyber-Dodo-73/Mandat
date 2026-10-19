package com.mandat.api.card;

import com.mandat.api.card.dto.CatalogResponse;
import com.mandat.api.common.config.OpenApiConfig;
import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Duration;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.WebRequest;

@RestController
@RequestMapping("/api/v1/cards")
@Tag(name = "Cards")
@SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
public class CardController {

    private final CardCatalogService catalogService;
    private final CatalogProperties properties;

    public CardController(CardCatalogService catalogService, CatalogProperties properties) {
        this.catalogService = catalogService;
        this.properties = properties;
    }

    @GetMapping
    @Operation(
            summary = "Season card catalog",
            description = "Cacheable: the ETag is the catalog content hash, send If-None-Match to get a 304.")
    public ResponseEntity<CatalogResponse> catalog(@RequestParam(required = false) Integer season, WebRequest request) {
        int requestedSeason = season == null ? properties.season() : season;
        CatalogResponse catalog = catalogService.catalog(requestedSeason)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Unknown season"));
        String etag = "\"" + catalog.version() + "\"";
        if (request.checkNotModified(etag)) {
            return null;
        }
        return ResponseEntity.ok()
                .eTag(etag)
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePrivate().mustRevalidate())
                .body(catalog);
    }
}
