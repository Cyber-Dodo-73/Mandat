package com.mandat.api.user.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Partial update: only non-null fields are applied. */
public record UpdateSettingsRequest(
        @Schema(nullable = true, allowableValues = {"fr", "en"}) @Pattern(regexp = "fr|en") String language,
        @Schema(nullable = true, example = "Europe/Paris") @Size(max = 64) String timezone,
        @Schema(nullable = true) Boolean sound,
        @Schema(nullable = true) Boolean haptics,
        @Schema(nullable = true) Boolean notifications,
        @Schema(nullable = true) ReduceMotion reduceMotion) {}
