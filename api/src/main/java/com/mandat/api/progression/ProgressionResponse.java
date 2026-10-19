package com.mandat.api.progression;

import com.mandat.api.progression.RewardDto.UnlockDto;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

public record ProgressionResponse(
        int level,
        int totalXp,
        @Schema(description = "XP earned since the current level was reached") int xpIntoLevel,
        @Schema(types = {"integer", "null"}, description = "XP needed for the next level, null at max level")
                Integer xpForNextLevel,
        int seasonXp,
        @Schema(description = "Streak as of today (0 when broken)") int currentStreak,
        int bestStreak,
        @Schema(description = "A streak activity was already done today") boolean streakActiveToday,
        @Schema(description = "At least one streak freeze is in stock") boolean freezeAvailable,
        @Schema(description = "Streak freezes in stock (max 2), this week's free one included") int freezes,
        String timezone,
        Instant dailyResetAt,
        Instant weeklyResetAt,
        int influence,
        int bonusPacks,
        List<UnlockDto> unlocks) {}
