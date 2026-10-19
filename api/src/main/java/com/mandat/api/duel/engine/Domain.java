package com.mandat.api.duel.engine;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import com.mandat.api.card.AbilityEffect;
import com.mandat.api.card.Card;
import java.util.Arrays;

/** The stat compared in a duel round, drawn at random by the server. */
public enum Domain {
    INFLUENCE,
    DIPLOMACY,
    CHARISMA,
    STRATEGY;

    @JsonValue
    public String key() {
        return name().toLowerCase();
    }

    @JsonCreator
    public static Domain fromKey(String key) {
        return Arrays.stream(values()).filter(d -> d.key().equals(key)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown domain: " + key));
    }

    public int statOf(Card card) {
        return switch (this) {
            case INFLUENCE -> card.getStatInfluence();
            case DIPLOMACY -> card.getStatDiplomacy();
            case CHARISMA -> card.getStatCharisma();
            case STRATEGY -> card.getStatStrategy();
        };
    }

    /** True when an effect on {@code stat} counts in a round of this domain. */
    public boolean matches(AbilityEffect.Stat stat) {
        return stat == AbilityEffect.Stat.ANY || stat.name().equals(name());
    }

    public static int total(Card card) {
        return card.getStatInfluence() + card.getStatDiplomacy() + card.getStatCharisma() + card.getStatStrategy();
    }
}
