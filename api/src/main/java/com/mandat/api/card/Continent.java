package com.mandat.api.card;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Arrays;

/** Inhabited continents used by the catalog. Serialized as snake_case keys ("north_america"). */
public enum Continent {
    AFRICA,
    ASIA,
    EUROPE,
    NORTH_AMERICA,
    SOUTH_AMERICA,
    OCEANIA;

    @JsonValue
    public String key() {
        return name().toLowerCase();
    }

    @JsonCreator
    public static Continent fromKey(String key) {
        return Arrays.stream(values())
                .filter(continent -> continent.key().equals(key))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown continent: " + key));
    }
}
