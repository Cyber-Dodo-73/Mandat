package com.mandat.api.progression.achievement;

import com.mandat.api.common.config.OpenApiConfig;
import com.mandat.api.common.security.AuthenticatedUser;
import com.mandat.api.progression.RewardDto;
import com.mandat.api.progression.achievement.AchievementService.AchievementView;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/achievements")
@Tag(name = "Achievements", description = "Achievements and their progress")
@SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
public class AchievementController {

    private final AchievementService achievements;

    public AchievementController(AchievementService achievements) {
        this.achievements = achievements;
    }

    @GetMapping
    @Operation(operationId = "getAchievements", summary = "Every achievement with the player's progress")
    public AchievementsResponse getAchievements(@AuthenticationPrincipal AuthenticatedUser user) {
        List<AchievementDto> items = achievements.list(user.id()).stream().map(AchievementController::toDto).toList();
        int unlocked = (int) items.stream().filter(a -> a.unlockedAt() != null).count();
        return new AchievementsResponse(items, unlocked, items.size());
    }

    private static AchievementDto toDto(AchievementView view) {
        var def = view.definition();
        return new AchievementDto(
                def.id(),
                def.category(),
                def.metric().name(),
                def.param(),
                view.progress(),
                def.threshold(),
                view.unlockedAt(),
                RewardDto.from(def.reward()));
    }

    public record AchievementsResponse(List<AchievementDto> achievements, int unlockedCount, int totalCount) {}

    public record AchievementDto(
            @Schema(description = "Stable key, mapped to i18n by the app") String id,
            String category,
            String metric,
            @Schema(types = {"string", "null"}) String param,
            int progress,
            int threshold,
            @Schema(types = {"string", "null"}, format = "date-time") Instant unlockedAt,
            RewardDto reward) {}
}
