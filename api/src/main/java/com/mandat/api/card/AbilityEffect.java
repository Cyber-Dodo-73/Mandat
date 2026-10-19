package com.mandat.api.card;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Arrays;

/**
 * Machine-readable duel effect of a card ability (see data/content/GUIDELINES.md).
 *
 * @param stat           affected stat, null for {@link Type#TIE_BREAKER}
 * @param amount         1–3, null for {@link Type#TIE_BREAKER}
 * @param conditionValue value of the condition as text ("same", "modern", "diplomacy", "2"), null when the
 *                       condition takes none
 */
public record AbilityEffect(Type type, Stat stat, Integer amount, ConditionKind conditionKind, String conditionValue) {

    /** What the effect does when its condition holds. */
    public enum Type {
        BONUS("bonus"),
        MALUS("malus"),
        TIE_BREAKER("tieBreaker");

        private final String key;

        Type(String key) {
            this.key = key;
        }

        @JsonValue
        public String key() {
            return key;
        }

        @JsonCreator
        public static Type fromKey(String key) {
            return Arrays.stream(values()).filter(v -> v.key.equals(key)).findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Unknown effect type: " + key));
        }
    }

    /** A duel domain, or {@code any} for "the round's domain". */
    public enum Stat {
        INFLUENCE,
        DIPLOMACY,
        CHARISMA,
        STRATEGY,
        ANY;

        @JsonValue
        public String key() {
            return name().toLowerCase();
        }

        @JsonCreator
        public static Stat fromKey(String key) {
            return Arrays.stream(values()).filter(v -> v.key().equals(key)).findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Unknown effect stat: " + key));
        }
    }

    /** When the effect applies. */
    public enum ConditionKind {
        ALWAYS("always"),
        OPPONENT_CONTINENT("opponentContinent"),
        OPPONENT_ERA("opponentEra"),
        ROUND_DOMAIN("roundDomain"),
        ROUND("round"),
        BEHIND("behind"),
        OPPONENT_RARITY_HIGHER("opponentRarityHigher");

        private final String key;

        ConditionKind(String key) {
            this.key = key;
        }

        @JsonValue
        public String key() {
            return key;
        }

        @JsonCreator
        public static ConditionKind fromKey(String key) {
            return Arrays.stream(values()).filter(v -> v.key.equals(key)).findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Unknown effect condition: " + key));
        }
    }
}
