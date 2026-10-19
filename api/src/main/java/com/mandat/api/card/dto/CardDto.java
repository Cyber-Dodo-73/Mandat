package com.mandat.api.card.dto;

import com.mandat.api.card.AbilityEffect;
import com.mandat.api.card.Continent;
import com.mandat.api.card.Era;
import com.mandat.api.card.Rarity;
import io.swagger.v3.oas.annotations.media.Schema;

/** Catalog card, same shape as the mobile app's embedded catalog. */
public record CardDto(
        String id,
        String wikidataId,
        int number,
        LocalizedText name,
        LocalizedText role,
        @Schema(description = "ISO 3166-1 alpha-2 code") String country,
        Continent continent,
        Era era,
        @Schema(nullable = true) Integer birthYear,
        @Schema(nullable = true) Integer deathYear,
        boolean isLiving,
        double fameScore,
        Rarity rarity,
        LocalizedText bio,
        CardStatsDto stats,
        CardAbilityDto ability,
        boolean sensitive,
        @Schema(nullable = true) String artwork,
        @Schema(description = "False when the card was removed from the catalog file; owned copies stay valid")
        boolean active) {

    public record LocalizedText(String fr, String en) {}

    public record CardStatsDto(int influence, int diplomacy, int charisma, int strategy) {}

    public record CardAbilityDto(
            LocalizedText name,
            LocalizedText description,
            @Schema(nullable = true, description = "Machine-readable duel effect") AbilityEffectDto effect) {}

    public record AbilityEffectDto(
            AbilityEffect.Type type,
            @Schema(nullable = true, description = "Null for tieBreaker") AbilityEffect.Stat stat,
            @Schema(nullable = true, minimum = "1", maximum = "3", description = "Null for tieBreaker") Integer amount,
            EffectConditionDto condition) {

        public static AbilityEffectDto of(AbilityEffect effect) {
            return effect == null ? null : new AbilityEffectDto(effect.type(), effect.stat(), effect.amount(),
                    new EffectConditionDto(effect.conditionKind(), effect.conditionValue()));
        }
    }

    public record EffectConditionDto(
            AbilityEffect.ConditionKind kind,
            @Schema(nullable = true, description = "same|different, an era, a stat, or a round number as text")
            String value) {}
}
