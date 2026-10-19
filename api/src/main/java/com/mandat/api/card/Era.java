package com.mandat.api.card;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Arrays;

public enum Era {
    ANTIQUITY,
    MEDIEVAL,
    MODERN,
    CONTEMPORARY;

    @JsonValue
    public String key() {
        return name().toLowerCase();
    }

    @JsonCreator
    public static Era fromKey(String key) {
        return Arrays.stream(values())
                .filter(era -> era.key().equals(key))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown era: " + key));
    }
}
