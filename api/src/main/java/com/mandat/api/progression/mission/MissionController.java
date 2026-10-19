package com.mandat.api.progression.mission;

import com.mandat.api.common.config.OpenApiConfig;
import com.mandat.api.common.security.AuthenticatedUser;
import com.mandat.api.progression.ClaimResponse;
import com.mandat.api.progression.Reward;
import com.mandat.api.progression.RewardDto;
import com.mandat.api.progression.mission.MissionCatalog.Template;
import com.mandat.api.progression.mission.MissionRepository.MissionRow;
import com.mandat.api.progression.mission.MissionService.MissionsView;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/missions")
@Tag(name = "Missions", description = "Daily and weekly missions")
@SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
public class MissionController {

    private final MissionService missions;
    private final MissionCatalog catalog;
    private final Clock clock;

    public MissionController(MissionService missions, MissionCatalog catalog, Clock clock) {
        this.missions = missions;
        this.catalog = catalog;
        this.clock = clock;
    }

    @GetMapping
    @Operation(operationId = "getMissions", summary = "Current daily and weekly missions with progress")
    public MissionsResponse getMissions(@AuthenticationPrincipal AuthenticatedUser user) {
        MissionsView view = missions.currentMissions(user.id(), Instant.now(clock));
        return new MissionsResponse(
                view.daily().stream().map(this::toDto).toList(),
                view.weekly().stream().map(this::toDto).toList(),
                view.dailyResetAt(),
                view.weeklyResetAt());
    }

    @PostMapping("/{missionId}/claim")
    @Operation(operationId = "claimMission", summary = "Claim the reward of a completed mission")
    public ClaimResponse claimMission(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID missionId) {
        return ClaimResponse.from(missions.claim(user.id(), missionId, Instant.now(clock)));
    }

    private MissionDto toDto(MissionRow row) {
        RewardDto reward = RewardDto.from(catalog.find(row.templateId()).map(Template::reward).orElse(Reward.NONE));
        return new MissionDto(
                row.id(),
                row.templateId(),
                row.period().name(),
                row.type().name(),
                row.param(),
                row.progress(),
                row.target(),
                row.completedAt() != null,
                row.claimedAt() != null,
                reward);
    }

    public record MissionsResponse(List<MissionDto> daily, List<MissionDto> weekly, Instant dailyResetAt, Instant weeklyResetAt) {}

    public record MissionDto(
            UUID id,
            @Schema(description = "Stable template key, mapped to i18n by the app") String templateId,
            @Schema(allowableValues = {"daily", "weekly"}) String period,
            String type,
            @Schema(types = {"string", "null"}, description = "Continent key for continent missions") String param,
            int progress,
            int target,
            boolean completed,
            boolean claimed,
            RewardDto reward) {}
}
