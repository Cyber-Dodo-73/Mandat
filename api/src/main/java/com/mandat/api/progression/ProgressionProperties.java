package com.mandat.api.progression;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Tunable progression numbers ({@code mandat.progression.*}). */
@ConfigurationProperties(prefix = "mandat.progression")
public record ProgressionProperties(
        @DefaultValue XpGains xp,
        @DefaultValue Curve curve,
        @DefaultValue Season season) {

    /** XP granted per game event. */
    public record XpGains(
            @DefaultValue("20") int packOpened,
            @DefaultValue("5") int newCard,
            @DefaultValue("30") int quizCompleted,
            @DefaultValue("20") int perfectQuizBonus,
            @DefaultValue("15") int duelPlayed,
            @DefaultValue("25") int duelWonBonus,
            @DefaultValue("5") int cardsRecycled,
            @DefaultValue("10") int cardCrafted) {}

    /** XP needed to go from level n to n+1 is {@code base + step * (n - 1)}. */
    public record Curve(
            @DefaultValue("100") int base,
            @DefaultValue("50") int step,
            @DefaultValue("100") int maxLevel) {}

    /** Free season pass: {@code tiers} tiers, one every {@code xpPerTier} season XP. */
    public record Season(
            @DefaultValue("s1") String id,
            @DefaultValue("50") int tiers,
            @DefaultValue("200") int xpPerTier) {}
}
