package com.mandat.api.progression.streak;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Streak settings ({@code mandat.streak.*}).
 *
 * @param freezePriceInfluence price of one streak freeze in Influence
 * @param sceauxEnabled        the premium currency exists (real-money IAP); off until it ships
 * @param freezePriceSceaux    price of one freeze in Sceaux, once enabled
 * @param maxFriendStreaks     friend streaks (active + pending) a player can have
 * @param maxNudgesPerDay      nudges a player can send per local day
 */
@ConfigurationProperties(prefix = "mandat.streak")
public record StreakProperties(
        @DefaultValue("200") int freezePriceInfluence,
        @DefaultValue("false") boolean sceauxEnabled,
        @DefaultValue("10") int freezePriceSceaux,
        @DefaultValue("5") int maxFriendStreaks,
        @DefaultValue("10") int maxNudgesPerDay) {}
