package com.mandat.api.card.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

public record CatalogResponse(
        int season,
        @Schema(description = "Content hash of the seeded catalog file, also sent as the ETag") String version,
        List<CardDto> cards) {}
