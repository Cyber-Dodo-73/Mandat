package com.mandat.api.card;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Arrays;

/**
 * Visual version of a drawn card, rolled by the server at draw time. The collection counts every
 * (card, finish) pair separately. Odds live in {@code pack.draw.DrawOdds}.
 */
public enum CardFinish {
    STANDARD("standard"),
    HOLO("holo"),
    FULL_ART("full_art"),
    GOLD("gold");

    private final String key;

    CardFinish(String key) {
        this.key = key;
    }

    @JsonValue
    public String key() {
        return key;
    }

    @JsonCreator
    public static CardFinish fromKey(String key) {
        return Arrays.stream(values())
                .filter(finish -> finish.key.equals(key))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown finish: " + key));
    }
}
