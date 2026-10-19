package com.mandat.api.moderation.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class ModerationDtos {

    private ModerationDtos() {}

    public record ReportDto(
            UUID id,
            String reason,
            @Schema(nullable = true) String note,
            @Schema(allowableValues = {"open", "reviewed", "dismissed"}) String status,
            Instant createdAt,
            String targetNickname,
            String targetFriendCode,
            boolean targetBanned,
            String reporterFriendCode,
            @Schema(nullable = true) Instant handledAt,
            @Schema(nullable = true, allowableValues = {"none", "banned", "renamed"}) String resolution) {}

    public record ReportsResponse(List<ReportDto> reports) {}

    public record BanRequest(@NotBlank @Size(max = 280) String reason) {}

    public record ModeratedPlayer(String nickname, String friendCode, boolean banned) {}
}
