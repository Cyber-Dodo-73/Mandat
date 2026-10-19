package com.mandat.api.progression;

import java.time.LocalDate;
import java.util.UUID;

/** Row of {@code player_progress}. */
public record PlayerProgress(
        UUID userId,
        int totalXp,
        int level,
        String seasonId,
        int seasonXp,
        int currentStreak,
        int bestStreak,
        LocalDate lastActiveDay,
        String lastFreezeWeek) {}
