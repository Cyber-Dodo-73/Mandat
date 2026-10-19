package com.mandat.api.push.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class PushDtos {

    private PushDtos() {}

    /** Expo push token, e.g. {@code ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]}. */
    public static final String TOKEN_REGEX = "^Expo(nent)?PushToken\\[[A-Za-z0-9_\\-]{10,200}]$";

    public record RegisterDeviceRequest(
            @NotBlank @Size(max = 255) @Pattern(regexp = TOKEN_REGEX) String token,
            @NotBlank @Pattern(regexp = "^(ios|android)$") String platform,
            @Schema(description = "App language, used for the notification texts (fr or en)", nullable = true)
            @Pattern(regexp = "^(fr|en)$") String locale) {}

    public record PushPreferencesDto(
            boolean boosterReady, boolean streak, boolean friends, boolean events, boolean marketing,
            @Schema(description = "Nudges from friends (\"X te relance !\")") boolean nudges) {}

    /** Partial update: null fields keep their value. */
    public record PushPreferencesPatch(
            @Schema(nullable = true) Boolean boosterReady,
            @Schema(nullable = true) Boolean streak,
            @Schema(nullable = true) Boolean friends,
            @Schema(nullable = true) Boolean events,
            @Schema(nullable = true) Boolean marketing,
            @Schema(nullable = true) Boolean nudges) {}
}
