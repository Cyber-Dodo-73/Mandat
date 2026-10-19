package com.mandat.api.card;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Arrays;

/** Card rarity, ordered from the most common to the rarest. Serialized lowercase ("legendary"). */
public enum Rarity {
    COMMON,
    UNCOMMON,
    RARE,
    EPIC,
    LEGENDARY,
    MYTHIC;

    @JsonValue
    public String key() {
        return name().toLowerCase();
    }

    @JsonCreator
    public static Rarity fromKey(String key) {
        return Arrays.stream(values())
                .filter(rarity -> rarity.key().equals(key))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown rarity: " + key));
    }

    public boolean isAtLeast(Rarity other) {
        return compareTo(other) >= 0;
    }
}
