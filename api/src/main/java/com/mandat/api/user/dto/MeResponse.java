package com.mandat.api.user.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record MeResponse(Account account, SettingsDto settings, Wallet wallet,
        @Schema(description = "Sections added by other domains (progression, packs...), keyed by MeContributor#key")
        Map<String, Object> sections,
        Instant serverTime) {

    public record Account(
            UUID id,
            String nickname,
            String friendCode,
            @Schema(nullable = true) String email,
            boolean hasPassword,
            @Schema(description = "Linked social providers", allowableValues = {"APPLE", "GOOGLE"})
            List<String> linkedProviders,
            Instant createdAt) {}

    public record Wallet(int influence, int bonusPacks) {}
}
